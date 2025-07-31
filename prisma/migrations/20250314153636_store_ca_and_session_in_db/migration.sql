-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "certificate" TEXT NOT NULL,
    "blacklisted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "token" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("token")
);
