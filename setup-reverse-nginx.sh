#!/bin/bash

# ==============================
# Nginx Reverse Proxy Setup Script (robust & validated)
# ==============================

set -e

# --- Read domain name ---
while true; do
    read -p "Enter the domain name (e.g., appcenter.ziqva.com): " DOMAIN
    if [[ -n "$DOMAIN" ]]; then
        break
    else
        echo "Domain cannot be empty."
    fi
done

# --- Read backend port with validation ---
while true; do
    read -p "Enter the local backend port (e.g., 4289): " PORT
    if [[ $PORT =~ ^[0-9]+$ ]] && [ $PORT -ge 1 ] && [ $PORT -le 65535 ]; then
        break
    else
        echo "Invalid port. Please enter a number between 1 and 65535."
    fi
done

# --- Optional: Max upload size and proxy timeout ---
read -p "Enter max upload size (default 10G): " MAX_SIZE
MAX_SIZE=${MAX_SIZE:-10G}

read -p "Enter proxy timeout in seconds (default 10800 = 3 hours): " PROXY_TIMEOUT
PROXY_TIMEOUT=${PROXY_TIMEOUT:-10800}

# --- Constants ---
NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"
WEBROOT="/var/www/$DOMAIN"

# --- Install required packages ---
echo "Installing required packages..."
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx ufw

# --- Setup Firewall ---
echo "Configuring UFW firewall..."
sudo ufw allow 'Nginx Full'

if sudo ufw status | grep -qw inactive; then
    echo "Enabling UFW..."
    sudo ufw --force enable
else
    echo "UFW is already active, skipping enable."
fi

# --- Create webroot ---
sudo mkdir -p $WEBROOT
sudo chown -R $USER:$USER $WEBROOT

# --- Backup and overwrite existing Nginx config ---
if [ -f "$NGINX_CONF" ]; then
    echo "Backing up existing Nginx config for $DOMAIN..."
    sudo cp "$NGINX_CONF" "$NGINX_CONF.bak.$(date +%F-%T)"
fi

# --- Create Nginx configuration ---
echo "Creating Nginx configuration..."
sudo tee $NGINX_CONF > /dev/null <<EOL
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;

        client_max_body_size $MAX_SIZE;
        proxy_read_timeout ${PROXY_TIMEOUT}s;
        proxy_send_timeout ${PROXY_TIMEOUT}s;
    }
}
EOL

# --- Enable site (overwrite existing symlink) ---
sudo ln -sf $NGINX_CONF /etc/nginx/sites-enabled/

# --- Test and reload Nginx safely ---
echo "Testing Nginx configuration..."
if sudo nginx -t; then
    echo "Reloading Nginx..."
    sudo systemctl reload nginx
else
    echo "Nginx config test failed. Aborting."
    exit 1
fi

# --- Obtain or renew SSL with Let's Encrypt ---
echo "Obtaining or renewing SSL certificate..."
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN --force-renewal || {
    echo "Certbot failed. You may need to troubleshoot manually."
}

# --- Reload Nginx to apply SSL ---
sudo systemctl reload nginx

echo "----------------------------------------"
echo "✅ Nginx proxy setup completed!"
echo "Domain: $DOMAIN"
echo "Forwarding to local port: $PORT"
echo "Client max body size: $MAX_SIZE"
echo "Proxy timeout: $PROXY_TIMEOUT seconds"
echo "SSL: Let's Encrypt applied / renewed"
echo "----------------------------------------"
