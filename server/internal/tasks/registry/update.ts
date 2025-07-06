import { type } from "arktype";
import * as semver from "semver";
import { defineDropTask } from "..";
import { systemConfig } from "../../config/sys-conf";
import notificationSystem from "../../notifications";

const latestRelease = type({
  url: "string", // api url for specific release
  html_url: "string", // user facing url
  id: "number", // release id
  tag_name: "string", // tag used for release
  name: "string", // release name
  draft: "boolean",
  prerelease: "boolean",
  created_at: "string",
  published_at: "string",
});

export default defineDropTask({
  buildId: () => `check:update:${new Date().toISOString()}`,
  name: "Check for Update",
  acls: ["system:maintenance:read"],
  taskGroup: "check:update",
  async run({ logger }) {
    // TODO: maybe implement some sort of rate limit thing to prevent this from calling github api a bunch in the event of crashloop or whatever?
    // probably will require custom task scheduler for object cleanup anyway, so something to thing about

    if (!systemConfig.shouldCheckForUpdates()) {
      logger.info("Update check is disabled by configuration");
      return;
    }

    logger.info("Checking for update");

    const currVerStr = systemConfig.getDropVersion();
    const currVer = semver.coerce(currVerStr);
    if (currVer === null) {
      const msg = "Drop provided a invalid semver tag";
      logger.info(msg);
      throw new Error(msg);
    }

    const response = await fetch(
      "https://api.github.com/repos/Drop-OSS/drop/releases/latest",
    );

    // if response failed somehow
    if (!response.ok) {
      logger.info("Failed to check for update ", {
        status: response.status,
        body: response.body,
      });

      throw new Error(
        `Failed to check for update: ${response.status} ${response.body}`,
      );
    }

    // parse and validate response
    const resJson = await response.json();
    const body = latestRelease(resJson);
    if (body instanceof type.errors) {
      logger.info(body.summary);
      logger.info("GitHub Api response" + JSON.stringify(resJson));
      throw new Error(
        `GitHub Api response did not match expected schema: ${body.summary}`,
      );
    }

    // parse remote version
    const latestVer = semver.coerce(body.tag_name);
    if (latestVer === null) {
      const msg = "Github Api returned invalid semver tag";
      logger.info(msg);
      throw new Error(msg);
    }

    // TODO: handle prerelease identifiers https://github.com/npm/node-semver#prerelease-identifiers
    // check if is newer version
    if (semver.gt(latestVer, currVer)) {
      logger.info("Update available");
      notificationSystem.systemPush({
        nonce: `drop-update-available-${currVer}-to-${latestVer}`,
        title: `Update available to v${latestVer}`,
        description: `A new version of Drop is available v${latestVer}`,
        actions: [`View|${body.html_url}`],
        acls: ["system:notifications:read"],
      });
    } else {
      logger.info("no update available");
    }

    logger.info("Done");
  },
});
