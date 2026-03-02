import fs from 'fs/promises';
import path from 'path';

export const createTempFolder = async () => {
    const tempPath = path.join(__dirname, "../../tmp");
    await fs.mkdir(tempPath, { recursive: true });
}