-- Migration para corrigir drift entre schema e banco de dados
-- Esta migration sincroniza o estado atual do banco com o schema

-- 1. Garantir que performedById é nullable (já está no banco, mas migration original tinha NOT NULL)
ALTER TABLE "audit_logs" ALTER COLUMN "performedById" DROP NOT NULL;

-- 2. Remover coluna email de login_logs se existir (já foi removida do banco)
-- Nota: A coluna já não existe no banco, então este comando não faz nada se já foi removida
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'login_logs' AND column_name = 'email'
    ) THEN
        ALTER TABLE "login_logs" DROP COLUMN "email";
    END IF;
END $$;

-- 3. Adicionar deletedAt em profiles se não existir (já existe no banco)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'deletedAt'
    ) THEN
        ALTER TABLE "profiles" ADD COLUMN "deletedAt" TIMESTAMP(3);
    END IF;
END $$;

