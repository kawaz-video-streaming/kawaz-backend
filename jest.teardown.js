const { rmSync, existsSync } = require('fs');
const path = require('path');

module.exports = async () => {
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (existsSync(tmpDir)) {
        rmSync(tmpDir, { recursive: true, force: true });
    }
};
