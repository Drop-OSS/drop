import type { systemACLs, userACLs } from ".";

type ObjectFromList<T extends ReadonlyArray<string>, V = string> = {
  [K in T extends ReadonlyArray<infer U> ? U : never]: V;
};

export const userACLDescriptions: ObjectFromList<typeof userACLs> = {
  read: "Fetch user information like username, display name, email, etc...",

  "store:read":
    "Fetch and search the store for games, developers and publishers.",

  "object:read":
    "Read object objects like game images, profile pictures, and downloads.",
  "object:update":
    "Update objects like game images, profile pictures, and downloads.",
  "object:delete":
    "Delete objects like game images, profile pictures, and downloads.",

  "notifications:read": "Fetch this account's notifications.",
  "notifications:mark": "Mark notifications as read for this account.",
  "notifications:listen": "Connect to a websocket to recieve notifications.",
  "notifications:delete": "Delete this account's notifications.",

  "screenshots:new": "Create screenshots for this account",
  "screenshots:read": "Read all screenshots for this account",
  "screenshots:delete": "Delete a screenshot for this account",

  "collections:new": "Create collections for this account.",
  "collections:read": "Fetch all collections (including library).",
  "collections:delete": "Delete a collection for this account.",
  "collections:add": "Add a game to any collection (excluding library).",
  "collections:remove":
    "Remove a game from any collection (excluding library).",
  "library:add": "Add a game to your library.",
  "library:remove": "Remove a game from your library.",

  "clients:read": "Read the clients connected to this account",
  "clients:revoke": "",

  "news:read": "Read the server's news articles.",
};

export const systemACLDescriptions: ObjectFromList<typeof systemACLs> = {
  "auth:read":
    "Fetch the list of enabled authentication mechanisms configured.",
  "auth:simple:invitation:read": "Fetch simple auth invitations.",
  "auth:simple:invitation:new": "Create new simple auth invitations.",
  "auth:simple:invitation:delete": "Delete a simple auth invitation.",

  "library:read": "Fetch a list of all games on this instance.",
  "library:sources:read":
    "Fetch a list of all library sources on this instance",
  "library:sources:new": "Create a new library source.",
  "library:sources:update": "Update existing library sources.",
  "library:sources:delete": "Delete library sources.",

  "notifications:read": "Read system notifications.",
  "notifications:mark": "Mark system notifications as read.",
  "notifications:listen": "Connect to the system notification websocket.",
  "notifications:delete": "Delete system notifications.",

  "game:read": "Fetch a given game on this instance.",
  "game:update": "Update a game on this instance.",
  "game:delete": "Delete a game on this instance.",
  "game:version:update": "Update the version order on a game.",
  "game:version:delete": "Delete a version for a game.",
  "game:image:new": "Upload an image for a game.",
  "game:image:delete": "Delete an image for a game.",

  "import:version:read":
    "Fetch versions to be imported, and information about versions to be imported.",
  "import:version:new": "Import a game version.",
  "import:game:read":
    "Fetch games to be imported, and search the metadata for games.",
  "import:game:new": "Import a game.",

  "user:read": "Fetch any user's information.",

  "news:read": "Read news articles.",
  "news:create": "Create a new news article.",
  "news:delete": "Delete a news article.",
};
