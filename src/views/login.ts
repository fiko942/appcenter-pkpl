import { baseLayout } from './layout';

export const loginPage = (error?: string): string => {
    const content = `
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-md animate-fade-in">
      <!-- Logo/Header -->
      <div class="text-center mb-8">
        <div class="w-20 h-20 mx-auto bg-gradient-to-r from-primary to-secondary rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-primary/30">
          <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
          </svg>
        </div>
        <h1 class="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Admin Panel</h1>
        <p class="text-gray-400 mt-2">Masukkan PIN untuk melanjutkan</p>
      </div>

      <!-- Login Card -->
      <div class="card p-8">
        ${error ? `
        <div class="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6 text-red-400 text-center">
          <svg class="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          ${error}
        </div>
        ` : ''}

        <form id="loginForm" method="POST" action="/admin/login">
          <!-- PIN Input -->
          <div class="mb-6">
            <label class="block text-gray-400 text-sm font-medium mb-3 text-center">Masukkan 6 Digit PIN</label>
            <div class="flex justify-center gap-3" id="pinContainer">
              <input type="password" maxlength="1" class="pin-input input-dark rounded-xl text-white font-bold" data-index="0" autocomplete="off">
              <input type="password" maxlength="1" class="pin-input input-dark rounded-xl text-white font-bold" data-index="1" autocomplete="off">
              <input type="password" maxlength="1" class="pin-input input-dark rounded-xl text-white font-bold" data-index="2" autocomplete="off">
              <input type="password" maxlength="1" class="pin-input input-dark rounded-xl text-white font-bold" data-index="3" autocomplete="off">
              <input type="password" maxlength="1" class="pin-input input-dark rounded-xl text-white font-bold" data-index="4" autocomplete="off">
              <input type="password" maxlength="1" class="pin-input input-dark rounded-xl text-white font-bold" data-index="5" autocomplete="off">
            </div>
            <input type="hidden" name="pin" id="pinValue">
          </div>

          <!-- Submit Button -->
          <button type="submit" id="submitBtn" class="w-full btn-primary text-white font-semibold py-4 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed" disabled>
            <span id="btnText">Masuk</span>
            <svg id="btnLoader" class="hidden animate-spin ml-2 h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </button>
        </form>
      </div>

      <p class="text-center text-gray-500 text-sm mt-6">
        © 2026 Ziqva Labs. All rights reserved.
      </p>
    </div>
  </div>
  `;

    const scripts = `
  <script>
    $(document).ready(function() {
      const inputs = $('#pinContainer input');
      
      // Auto focus first input
      inputs.first().focus();
      
      // Handle input
      inputs.on('input', function() {
        const index = $(this).data('index');
        const value = $(this).val();
        
        if (value.length === 1 && index < 5) {
          inputs.eq(index + 1).focus();
        }
        
        // Collect all values
        let pin = '';
        inputs.each(function() {
          pin += $(this).val();
        });
        $('#pinValue').val(pin);
        
        // Enable/disable submit button
        $('#submitBtn').prop('disabled', pin.length !== 6);
      });
      
      // Handle backspace
      inputs.on('keydown', function(e) {
        const index = $(this).data('index');
        
        if (e.key === 'Backspace' && $(this).val() === '' && index > 0) {
          inputs.eq(index - 1).focus().val('');
        }
      });
      
      // Handle paste
      inputs.first().on('paste', function(e) {
        e.preventDefault();
        const paste = (e.originalEvent.clipboardData || window.clipboardData).getData('text');
        const digits = paste.replace(/\\D/g, '').substring(0, 6);
        
        digits.split('').forEach((digit, i) => {
          if (i < 6) {
            inputs.eq(i).val(digit);
          }
        });
        
        $('#pinValue').val(digits);
        $('#submitBtn').prop('disabled', digits.length !== 6);
        
        if (digits.length === 6) {
          inputs.eq(5).focus();
        }
      });
      
      // Handle form submit
      $('#loginForm').on('submit', function() {
        $('#btnText').text('Memverifikasi...');
        $('#btnLoader').removeClass('hidden');
        $('#submitBtn').prop('disabled', true);
      });
    });
  </script>
  `;

    return baseLayout('Login', content, scripts);
};
