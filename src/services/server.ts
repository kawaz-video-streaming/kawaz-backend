import express,{Express} from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import {StatusCodes} from 'http-status-codes';
import http from 'http';

export interface ServerConfig {
    port: number;
}

const registerMiddlewares = (app: Express) => {
    app.use(cors())
    app.use(express.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    return app;
}

const registerRoutes = (app: Express) => {
    app.get('/health', (_req, res) => {
        res.sendStatus(StatusCodes.OK);
    }); 
    return app;
}

export const startServer = async (config: ServerConfig) => {
    const app = express();
    const appWithMiddlewares = registerMiddlewares(app);
    const appWithRoutes = registerRoutes(appWithMiddlewares);
    const server = http.createServer(appWithRoutes);
    const { port } = config;
    return new Promise<void>((resolve, reject) => {
        server.listen(port, () => {
            console.log(`Server is running on port ${port}`);
            resolve();
        }).on('error', (error) => {
            console.error('Error starting the server:', error);
            reject(error);
        });
    });
}