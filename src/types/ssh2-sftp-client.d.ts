declare module 'ssh2-sftp-client' {
    import { ConnectConfig } from 'ssh2';

    interface FileInfo {
        type: string;
        name: string;
        size: number;
        modifyTime: number;
        accessTime: number;
        rights: {
            user: string;
            group: string;
            other: string;
        };
        owner: number;
        group: number;
    }

    interface FastPutOptions {
        concurrency?: number;
        chunkSize?: number;
        step?: (total_transferred: number, chunk: number, total: number) => void;
    }

    class SftpClient {
        constructor(name?: string);
        connect(options: ConnectConfig & { retries?: number; retry_factor?: number; retry_minTimeout?: number; autoClose?: boolean }): Promise<any>;
        list(remoteFilePath: string, pattern?: string | RegExp): Promise<FileInfo[]>;
        exists(remotePath: string): Promise<false | 'd' | '-' | 'l'>;
        stat(remotePath: string): Promise<FileInfo>;
        fastPut(localPath: string, remotePath: string, options?: FastPutOptions): Promise<string>;
        delete(remotePath: string, notCheck?: boolean): Promise<string>;
        mkdir(remoteFilePath: string, recursive?: boolean): Promise<string>;
        rmdir(remoteFilePath: string, recursive?: boolean): Promise<string>;
        end(): Promise<void>;
    }

    export = SftpClient;
}
