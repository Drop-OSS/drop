-- CreateTable
CREATE TABLE "ApplicationSettings" (
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enabledAuthencationMechanisms" "AuthMec"[],

    CONSTRAINT "ApplicationSettings_pkey" PRIMARY KEY ("timestamp")
);
