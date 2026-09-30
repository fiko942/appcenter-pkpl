import app from './app';
import { CONFIG } from './config';

const PORT = CONFIG.PORT;

const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT} in ${CONFIG.NODE_ENV} mode`);
    console.log(`Health check available at http://localhost:${PORT}/health`);
    console.log(`API Docs/Endpoints at http://localhost:${PORT}/api/v1/`);
});

server.on('error', (err) => {
    console.error('Server failed to start:', err);
});

