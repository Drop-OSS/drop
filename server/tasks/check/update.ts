import { type } from "arktype";
import { systemConfig } from "../../internal/config/sys-conf";
import * as semver from "semver";
import type { TaskReturn } from "../../h3";
import notificationSystem from "../../internal/notifications";

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

export default defineTask<TaskReturn>({
  meta: {
    name: "check:update",
  },
  async run() {
    if (systemConfig.shouldCheckForUpdates()) {
      console.log("[Task check:update]: Checking for update");

      const currVerStr = systemConfig.getDropVersion();
      const currVer = semver.coerce(currVerStr);
      if (currVer === null) {
        const msg = "Drop provided a invalid semver tag";
        console.log("[Task check:update]:", msg);
        return {
          result: {
            success: false,
            error: {
              message: msg,
            },
          },
        };
      }

      try {
        const response = await fetch(
          "https://api.github.com/repos/Drop-OSS/drop/releases/latest",
        );

        // if response failed somehow
        if (!response.ok) {
          console.log("[Task check:update]: Failed to check for update", {
            status: response.status,
            body: response.body,
          });

          return {
            result: {
              success: false,
              error: {
                message: "" + response.status,
              },
            },
          };
        }

        // parse and validate response
        const resJson = await response.json();
        const body = latestRelease(resJson);
        if (body instanceof type.errors) {
          console.error(body.summary);
          console.log("GitHub Api response", resJson);
          return {
            result: {
              success: false,
              error: {
                message: body.summary,
              },
            },
          };
        }

        // parse remote version
        const latestVer = semver.coerce(body.tag_name);
        if (latestVer === null) {
          const msg = "Github Api returned invalid semver tag";
          console.log("[Task check:update]:", msg);
          return {
            result: {
              success: false,
              error: {
                message: msg,
              },
            },
          };
        }

        // TODO: handle prerelease identifiers https://github.com/npm/node-semver#prerelease-identifiers
        // check if is newer version
        if (semver.gt(latestVer, currVer)) {
          console.log("[Task check:update]: Update available");
          notificationSystem.systemPush({
            nonce: `drop-update-available-${currVer}-to-${latestVer}`,
            title: `Update available to v${latestVer}`,
            description: `A new version of Drop is available v${latestVer}`,
            actions: [`View|${body.html_url}`],
            acls: ["system:notifications:read"],
          });
        } else {
          console.log("[Task check:update]: no update available");
        }

        console.log("[Task check:update]: Done");
      } catch (e) {
        console.error(e);
        if (typeof e === "string") {
          return {
            result: {
              success: false,
              error: {
                message: e,
              },
            },
          };
        } else if (e instanceof Error) {
          return {
            result: {
              success: false,
              error: {
                message: e.message,
              },
            },
          };
        }

        return {
          result: {
            success: false,
            error: {
              message: "unknown cause, please check console",
            },
          },
        };
      }
    }
    return {
      result: {
        success: true,
        data: undefined,
      },
    };
  },
});
