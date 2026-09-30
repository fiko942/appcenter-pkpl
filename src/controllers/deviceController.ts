import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { deviceLicensePage, DeviceLicenseData } from '../views/device-license';
import { getClientIp } from '../utils/ipHelper';

export const checkDeviceStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { product, machine_id } = req.query;

        if (!product || !machine_id) {
            res.status(400).json({
                status: 'error',
                message: 'Missing product or machine_id query parameters',
            });
            return;
        }

        const productName = String(product);
        const machineId = String(machine_id);
        const currentTimestamp = Math.floor(Date.now() / 1000);

        // 1. Check in Device table (Premium/Paid users)
        const device = await prisma.device.findFirst({
            where: {
                machine_id: machineId,
                product: productName,
                expired: {
                    gt: currentTimestamp, // Not expired
                },
            },
            orderBy: {
                expired: 'desc',
            },
        });

        // 2. Check in Trial table (Trial users)
        const trial = await prisma.trial.findFirst({
            where: {
                machine_id: machineId,
                product: productName,
                expired: {
                    gt: currentTimestamp, // Not expired
                },
            },
            orderBy: {
                expired: 'desc',
            },
        });

        let isRegistered = false;
        const userData = {
            email: '',
            name: '',
        };
        const licenseData = {
            created: '-',
            expired: '-',
            remaining: '-',
            label: '-',
            product: productName
        };

        const formatDate = (epoch: any) => {
            const num = Number(epoch);
            if (!num || num <= 0) return '-';
            // If year is 1970/1971, it's likely invalid/zero-ish
            const date = new Date(num * 1000);
            if (date.getFullYear() < 2000) return '-';

            return date.toLocaleDateString('id-ID', {
                day: 'numeric', month: 'long', year: 'numeric'
            });
        };

        const getRemaining = (expiry: any) => {
            const num = Number(expiry);
            if (!num || num <= 0) return '-';
            const diff = num - currentTimestamp;
            if (diff <= 0) return 'Expired';
            const days = Math.floor(diff / 86400);
            if (days > 0) return `${days} Hari`;
            const hours = Math.floor(diff / 3600);
            if (hours > 0) return `${hours} Jam`;
            const minutes = Math.floor(diff / 60);
            return `${minutes} Menit`;
        };

        if (device) {
            isRegistered = true;
            userData.email = device.email;
            // Fetch name
            const user = await prisma.user.findFirst({ where: { email: device.email } });
            if (user) userData.name = user.name;
            else userData.name = 'Premium Member';

            licenseData.created = formatDate(device.created);
            licenseData.expired = formatDate(device.expired);
            licenseData.remaining = getRemaining(device.expired);
            licenseData.label = device.label || 'Premium License';

        } else if (trial) {
            isRegistered = true;
            userData.email = trial.user === 'WAITING_ACTIVATION' ? 'Trial User' : trial.user;
            // Fetch name via trial.user (assuming it's email)
            const user = await prisma.user.findFirst({ where: { email: trial.user } });
            if (user) userData.name = user.name;
            else userData.name = 'Trial User';

            licenseData.created = formatDate(trial.created);
            licenseData.expired = formatDate(trial.expired);
            licenseData.remaining = getRemaining(trial.expired);
            // Show truncated token as label
            licenseData.label = trial.token ? `TRIAL-${trial.token.slice(-5)}` : 'Trial License';
        }

        // Response format matching legacy but enriched
        res.json({
            tobelsoft: {
                status: 200,
                message: isRegistered ? "Device Registered" : "Device Not Registered",
                data: {
                    registered: isRegistered,
                    user: {
                        email: userData.email,
                        name: userData.name,
                    },
                    // Flattened details for ease of access
                    created: licenseData.created,
                    expired: licenseData.expired,
                    remaining: licenseData.remaining,
                    label: licenseData.label,
                    product: licenseData.product,
                    // Also nested if preferred
                    license: licenseData
                },
            },
        });

    } catch (error) {
        next(error);
    }
};

// Custom session interface (duplicated from MemberController - ideally shared)
interface MemberSession {
    userName?: string;
    userEmail?: string;
    userAvatar?: string;
    isMemberAuthenticated?: boolean;
}

export const showDeviceLicensePage = async (req: Request, res: Response) => {
    const session = req.session as unknown as MemberSession;
    if (!session || !session.isMemberAuthenticated) {
        return res.redirect('/member/login');
    }
    const userEmail = session.userEmail || '';
    // Ambil semua device milik user
    const devices = await prisma.device.findMany({ where: { email: userEmail }, orderBy: { id: 'desc' } });

    const deviceData: DeviceLicenseData[] = devices.map(device => ({
        id: device.id,
        licenseKey: device.label || String(device.id),
        isActivated: !!device.machine_id,
        expired: device.expired,
        duration: device.duration,
        machineId: device.machine_id,
        label: device.label,
    }));
    const user = { name: session.userName || 'Member', email: userEmail, avatar: session.userAvatar };
    res.send(deviceLicensePage(deviceData, user));
};

export const updateDeviceMachineId = async (req: Request, res: Response) => {
    const session = req.session as unknown as MemberSession;
    if (!session || !session.isMemberAuthenticated) {
        return res.redirect('/member/login');
    }
    const userEmail = session.userEmail || '';
    const deviceId = Number(req.params.deviceId);
    const body = req.body as { machine_id?: string };
    const machine_id = body.machine_id;

    if (!deviceId || !machine_id) return res.redirect('/member/device?error=invalid');
    // Pastikan device milik user
    const device = await prisma.device.findFirst({ where: { id: deviceId, email: userEmail } });
    if (!device) return res.redirect('/member/device?error=notfound');
    await prisma.device.update({ where: { id: deviceId }, data: { machine_id } });
    res.redirect('/member/device?success=updated');
};

export const activateLicense = async (req: Request, res: Response, _next: NextFunction) => {
    try {
        const { token, product, machine_id } = req.query;

        if (!token || !product || !machine_id) {
            res.json({
                tobelsoft: {
                    error: true,
                    message: 'Missing token, product, or machine_id'
                }
            });
            return;
        }

        const licenseKey = String(token).trim();
        const productName = String(product);
        const machineId = String(machine_id);
        const now = Math.floor(Date.now() / 1000);

        // 1. Check for License in token_device_activation
        const license = await prisma.token_device_activation.findFirst({
            where: {
                token: licenseKey,
                product: productName
            }
        });

        if (license) {
            // Check for existing device linked to this license
            const existingDevice = await prisma.device.findFirst({
                where: {
                    order_id: license.order_id,
                    product: productName,
                    email: license.user || undefined
                },
                orderBy: {
                    created: 'desc'
                }
            });

            if (existingDevice) {
                // Device exists, check expiry
                if (existingDevice.expired < now) {
                    res.json({
                        tobelsoft: {
                            error: true,
                            message: 'License expired'
                        }
                    });
                    return;
                }

                // Not expired -> Update Machine ID (Transfer License)
                await prisma.device.update({
                    where: { id: existingDevice.id },
                    data: {
                        machine_id: machineId
                    }
                });

                // Also ensure token is marked taked
                if (!license.taked) {
                    await prisma.token_device_activation.update({
                        where: { id: license.id },
                        data: {
                            taked: 1,
                            taked_at: now,
                            taked_ip: getClientIp(req)
                        }
                    });
                }

                res.json({
                    tobelsoft: {
                        error: false,
                        message: 'Device updated successfully'
                    }
                });
                return;

            } else {
                // Device does not exist -> Create New Device
                const expiredDate = now + (license.duration * 60);

                await prisma.device.create({
                    data: {
                        order_id: license.order_id,
                        email: license.user || '',
                        product: productName,
                        machine_id: machineId,
                        created: now,
                        duration: license.duration, // Minutes
                        expired: expiredDate, // Seconds (Epoch)
                        label: `#${now}`
                    }
                });

                // Mark token as taked
                await prisma.token_device_activation.update({
                    where: { id: license.id },
                    data: {
                        taked: 1,
                        taked_at: now,
                        taked_ip: getClientIp(req)
                    }
                });

                res.json({
                    tobelsoft: {
                        error: false,
                        message: 'Device activated successfully'
                    }
                });
                return;
            }
        }

        // 2. If License not found, check Trial table
        const trial = await prisma.trial.findFirst({
            where: {
                token: licenseKey,
                product: productName
            }
        });

        if (trial) {
            // Check if already used
            if (trial.machine_id && trial.machine_id !== '') {
                res.json({
                    tobelsoft: {
                        error: true,
                        message: 'Kode trial tidak bisa diaktifkan 2x'
                    }
                });
                return;
            }

            if (trial.expired < now) {
                res.json({
                    tobelsoft: {
                        error: true,
                        message: 'Trial expired'
                    }
                });
                return;
            }

            // Update machine_id in Trial table to activate it for this device
            await prisma.trial.update({
                where: { id: trial.id },
                data: {
                    machine_id: machineId
                }
            });

            res.json({
                tobelsoft: {
                    error: false,
                    message: 'Trial activated successfully'
                }
            });
            return;
        }

        // 3. Not found in License or Trial
        res.json({
            tobelsoft: {
                error: true,
                message: 'License/Trial invalid or not found'
            }
        });

    } catch (error) {
        console.error(error);
        res.json({
            tobelsoft: {
                error: true,
                message: 'Internal Server Error'
            }
        });
    }
};
