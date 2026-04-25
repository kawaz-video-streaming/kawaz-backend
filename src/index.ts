import { getConfig } from "./config";
import { createTempFolder } from "./utils/files";
import { startSystem } from "./services/system";

const main = async () => {
    const config = getConfig();
    if (config.nodeEnv === "local") {
        await createTempFolder();
    }
    await startSystem(config);
};

main().then(() => {
    console.log("System started successfully");
}).catch((error) => {
    console.error(`Error starting the system: \n${error.message}`);
    process.exit(1);
});
