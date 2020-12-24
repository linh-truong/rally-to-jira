import * as dotenv from "dotenv";
dotenv.config();

import container from "./container";

const main = async () => {
  const rallyService = container.cradle.rallyService;
  const artifacts = await rallyService.scanArtifact();
  // const attachments = await rallyService.scanAttachment();
  process.exit();
};

main();
