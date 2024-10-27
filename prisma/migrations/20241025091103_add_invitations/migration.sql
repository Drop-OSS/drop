-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "username" TEXT,
    "email" TEXT,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);
