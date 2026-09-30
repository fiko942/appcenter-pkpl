import { baseLayout } from './layout';

export interface DeviceLicenseData {
  id: number;
  licenseKey: string;
  isActivated: boolean;
  expired: number | null;
  duration: number;
  machineId: string;
  label?: string | null;
}

function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '-';
  if (minutes < 60) return `${minutes} menit`;
  if (minutes < 1440) {
    const jam = Math.floor(minutes / 60);
    const sisa = minutes % 60;
    return `${jam} jam${sisa ? ` ${sisa} menit` : ''}`;
  }
  const hari = Math.floor(minutes / 1440);
  const sisa = minutes % 1440;
  return `${hari} hari${sisa ? ` ${formatDuration(sisa)}` : ''}`;
}

export function deviceLicensePage(devices: DeviceLicenseData[], _user: { name: string; email: string; avatar?: string }): string {
  return baseLayout('Device & License', `
      <div class="max-w-4xl mx-auto py-8">
        <h1 class="text-2xl font-bold mb-6">Device & License</h1>
        <table class="min-w-full bg-gray-900 text-white rounded-lg overflow-hidden">
          <thead>
            <tr>
              <th class="px-4 py-2">License Key</th>
              <th class="px-4 py-2">Activated</th>
              <th class="px-4 py-2">Expired</th>
              <th class="px-4 py-2">Duration</th>
              <th class="px-4 py-2">Machine ID</th>
              <th class="px-4 py-2">Label</th>
              <th class="px-4 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${devices
      .map(
        (device) => `
              <tr class="border-b border-gray-700">
                <td class="px-4 py-2 font-mono select-all">${device.licenseKey} <button onclick="navigator.clipboard.writeText('${device.licenseKey}')" class="ml-2 text-blue-400 underline">Copy</button></td>
                <td class="px-4 py-2">${device.isActivated ? '<span class="text-green-400 font-semibold">Sudah</span>' : '<span class="text-yellow-400 font-semibold">Belum</span>'}</td>
                <td class="px-4 py-2">${device.expired ? new Date(device.expired * 1000).toLocaleString('id-ID') : '-'}</td>
                <td class="px-4 py-2">${formatDuration(device.duration)}</td>
                <td class="px-4 py-2">
                  <form method="POST" action="/member/device/${device.id}/edit-machine" class="flex items-center gap-2">
                    <input name="machine_id" value="${device.machineId}" class="bg-gray-800 px-2 py-1 rounded text-white w-48" />
                    <button type="submit" class="text-blue-400 underline">Ubah</button>
                  </form>
                </td>
                <td class="px-4 py-2">${device.label || '-'}</td>
                <td class="px-4 py-2"><button onclick="navigator.clipboard.writeText('${device.licenseKey}')" class="text-blue-400 underline">Copy</button></td>
              </tr>
            `
      )
      .join('')}
          </tbody>
        </table>
      </div>
    `);
}
