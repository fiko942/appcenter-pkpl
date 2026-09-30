#!/bin/bash
# Script enable FTP untuk user yang sudah ada (root)
# Jangan lupa ganti ROOT_PASS sesuai password root-mu

ROOT_USER="root"
ROOT_PASS="${ROOT_PASS:-your_secure_root_password}"
FTP_DIR="/root"             # Folder yang akan di-chroot
PASV_MIN=10000
PASV_MAX=10100

echo ">> Installing vsftpd..."
apt update && apt install vsftpd -y

echo ">> Backup vsftpd config"
cp /etc/vsftpd.conf /etc/vsftpd.conf.bak

echo ">> Setting root password (just in case)"
echo "$ROOT_USER:$ROOT_PASS" | chpasswd

echo ">> Configuring vsftpd..."
cat > /etc/vsftpd.conf <<EOL
listen=YES
listen_ipv6=NO
anonymous_enable=NO
local_enable=YES
write_enable=YES
chroot_local_user=YES
allow_writeable_chroot=YES

user_sub_token=\$USER
local_root=$FTP_DIR
pasv_enable=YES
pasv_min_port=$PASV_MIN
pasv_max_port=$PASV_MAX
EOL

echo ">> Restarting vsftpd..."
systemctl restart vsftpd
systemctl enable vsftpd

echo ">> Opening firewall ports..."
ufw allow 20/tcp
ufw allow 21/tcp
ufw allow $PASV_MIN:$PASV_MAX/tcp
ufw reload

echo "===================================="
echo "FTP setup selesai!"
echo "User: $ROOT_USER"
echo "Password: $ROOT_PASS"
echo "Folder chroot: $FTP_DIR"
echo "Passive ports: $PASV_MIN-$PASV_MAX"
echo "===================================="
