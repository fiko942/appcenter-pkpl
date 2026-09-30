// Base HTML Layout with Tailwind CSS & AppCenter Theme System
export const baseLayout = (title: string, content: string, scripts: string = ''): string => `
<!DOCTYPE html>
<html lang="id" data-theme="dark" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>${title} — Appcenter Ziqva</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="shortcut icon" href="/favicon.svg">
  
  <!-- Vendor & AppCenter Theme Stylesheet -->
  <link rel="stylesheet" href="/vendor/shadcn-tailwind-4.13.0.css">
  <link rel="stylesheet" href="/css/appcenter-theme.css">

  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
  
  <!-- Immediate Theme Init to prevent flash -->
  <script>
    (function() {
      try {
        var saved = localStorage.getItem('ziqva-theme');
        var isDark = saved ? (saved === 'dark') : true; // Default dark
        var html = document.documentElement;
        if (isDark) {
          html.setAttribute('data-theme', 'dark');
          html.classList.add('dark');
        } else {
          html.setAttribute('data-theme', 'light');
          html.classList.remove('dark');
        }
      } catch (e) {}
    })();

    tailwind.config = {
      darkMode: ['class', '[data-theme="dark"]'],
      theme: {
        extend: {
          colors: {
            brand: '#2457df',
            'brand-soft': '#e8efff',
            page: 'var(--page)',
            surface: 'var(--surface)',
            'surface-2': 'var(--surface-2)',
            border: 'var(--border)',
            text: 'var(--text)',
            'text-2': 'var(--text-2)',
            'text-3': 'var(--text-3)',
          }
        }
      }
    };

    window.toggleTheme = function() {
      var html = document.documentElement;
      var current = html.getAttribute('data-theme') || 'dark';
      var next = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      if (next === 'dark') {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }
      try {
        localStorage.setItem('ziqva-theme', next);
      } catch (e) {}
      
      // Dispatch custom event for any listening components
      window.dispatchEvent(new CustomEvent('themechanged', { detail: { theme: next } }));
    };
  </script>
</head>
<body class="min-h-screen">
  ${content}
  ${scripts}
</body>
</html>
`;
