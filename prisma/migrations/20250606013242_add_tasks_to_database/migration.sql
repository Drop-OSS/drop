-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "taskGroup" TEXT NOT NULL,
    "started" TIMESTAMP(3) NOT NULL,
    "ended" TIMESTAMP(3) NOT NULL,
    "success" BOOLEAN NOT NULL,
    "error" JSONB,
    "progress" DOUBLE PRECISION NOT NULL,
    "log" TEXT[],
    "acls" TEXT[],

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);
