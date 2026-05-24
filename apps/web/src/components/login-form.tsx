"use client"

import { FormEvent, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRightIcon, LoaderCircleIcon, LockIcon } from "lucide-react"
import { toast } from "sonner"

import { storeSession } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333"
const googleSsoUrl = `${apiBaseUrl}/auth/sso/google`

type LoginResponse = {
  access_token?: string
  mfaRequired?: boolean
  mfaToken?: string
  message?: string | string[]
}

function getErrorMessage(message?: string | string[]) {
  if (Array.isArray(message)) return message.join(" ")
  return message || "Não foi possível concluir o login."
}

export function LoginForm({
  className,
  nextPath = "/dashboard",
  ...props
}: React.ComponentProps<"div"> & {
  nextPath?: string
}) {
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [mfaCode, setMfaCode] = useState("")
  const [mfaToken, setMfaToken] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sendingRecovery, setSendingRecovery] = useState(false)

  const ssoUrl = useMemo(() => {
    const url = new URL(googleSsoUrl)
    if (nextPath && nextPath !== "/dashboard") {
      url.searchParams.set("next", nextPath)
    }
    return url.toString()
  }, [nextPath])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setForgotPasswordMessage(null)

    if (!email.trim() || !password) {
      setErrorMessage("Informe email e senha.")
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch(`${apiBaseUrl}/auth/signin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      })

      const json = (await response.json().catch(() => null)) as LoginResponse | null

      if (!response.ok) {
        throw new Error(getErrorMessage(json?.message))
      }

      if (json?.mfaRequired && json.mfaToken) {
        setMfaToken(json.mfaToken)
        toast.info("Segundo fator exigido. Informe o código para concluir o acesso.")
        return
      }

      if (!json?.access_token) {
        throw new Error("O backend não retornou o token de acesso.")
      }

      storeSession(json.access_token)
      router.replace(nextPath)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Falha ao autenticar.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMfaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)

    if (!mfaToken) {
      setErrorMessage("A sessão de segundo fator expirou. Faça login novamente.")
      return
    }

    if (!mfaCode.trim()) {
      setErrorMessage("Informe o código do autenticador ou de recuperação.")
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch(`${apiBaseUrl}/auth/mfa/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mfaToken,
          code: mfaCode.trim(),
        }),
      })

      const json = (await response.json().catch(() => null)) as LoginResponse | null

      if (!response.ok) {
        throw new Error(getErrorMessage(json?.message))
      }

      if (!json?.access_token) {
        throw new Error("O backend não retornou o token final de acesso.")
      }

      storeSession(json.access_token)
      router.replace(nextPath)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Falha ao validar o segundo fator.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleForgotPassword() {
    setErrorMessage(null)
    setForgotPasswordMessage(null)

    if (!email.trim()) {
      setErrorMessage("Informe o email para solicitar a recuperação de senha.")
      return
    }

    setSendingRecovery(true)

    try {
      const response = await fetch(`${apiBaseUrl}/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
        }),
      })

      const json = (await response.json().catch(() => null)) as { message?: string | string[] } | null

      if (!response.ok) {
        throw new Error(getErrorMessage(json?.message))
      }

      setForgotPasswordMessage(getErrorMessage(json?.message))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Falha ao solicitar a recuperação de senha.")
    } finally {
      setSendingRecovery(false)
    }
  }

  function resetMfaStep() {
    setMfaToken(null)
    setMfaCode("")
    setErrorMessage(null)
  }

  const isMfaStep = Boolean(mfaToken)

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form className="p-6 md:p-8" onSubmit={isMfaStep ? handleMfaSubmit : handleSubmit}>
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">
                  {isMfaStep ? "Confirmar segundo fator" : "Entrar no Fluxora"}
                </h1>
                <p className="text-balance text-muted-foreground">
                  {isMfaStep
                    ? "Informe o código do autenticador ou um código de recuperação para concluir o acesso."
                    : "Gestão financeira operacional com acesso simples e seguro."}
                </p>
              </div>

              {isMfaStep ? (
                <Field>
                  <FieldLabel htmlFor="mfaCode">Código MFA</FieldLabel>
                  <Input
                    id="mfaCode"
                    value={mfaCode}
                    onChange={(event) => setMfaCode(event.target.value)}
                    placeholder="123456 ou código de recuperação"
                    autoComplete="one-time-code"
                    required
                  />
                </Field>
              ) : (
                <>
                  <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      placeholder="voce@empresa.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="email"
                      required
                    />
                  </Field>
                  <Field>
                    <div className="flex items-center">
                      <FieldLabel htmlFor="password">Senha</FieldLabel>
                      <button
                        type="button"
                        className="ml-auto text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        onClick={() => void handleForgotPassword()}
                        disabled={sendingRecovery || submitting}
                      >
                        {sendingRecovery ? "Enviando..." : "Esqueci minha senha"}
                      </button>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                      required
                    />
                  </Field>
                </>
              )}

              {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
              {forgotPasswordMessage ? (
                <FieldDescription className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                  {forgotPasswordMessage}
                </FieldDescription>
              ) : null}

              <Field>
                <Button type="submit" disabled={submitting}>
                  {submitting ? <LoaderCircleIcon className="size-4 animate-spin" /> : <LockIcon className="size-4" />}
                  {isMfaStep ? "Confirmar acesso" : "Entrar com email e senha"}
                </Button>
              </Field>

              {isMfaStep ? (
                <Field>
                  <Button type="button" variant="outline" onClick={resetMfaStep} disabled={submitting}>
                    Voltar ao login
                  </Button>
                </Field>
              ) : (
                <>
                  <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                    ou continue com
                  </FieldSeparator>
                  <Field>
                    <a href={ssoUrl} className={buttonVariants({ variant: "outline", className: "w-full" })}>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <path
                          d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                          fill="currentColor"
                        />
                      </svg>
                      Entrar com Google
                      <ArrowRightIcon className="ml-auto size-4" />
                    </a>
                  </Field>
                </>
              )}

              {!isMfaStep ? (
                <FieldDescription className="text-center">
                  Ainda não tem workspace? O primeiro acesso cria sua área inicial.
                </FieldDescription>
              ) : null}
            </FieldGroup>
          </form>
          <div className="relative hidden bg-muted md:block">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(52,211,153,0.35),_transparent_45%),linear-gradient(135deg,_rgba(31,41,55,0.96),_rgba(17,24,39,0.88))]" />
            <div className="absolute inset-x-0 bottom-0 p-8 text-white">
              <p className="max-w-sm text-lg font-semibold leading-snug">
                Controle financeiro com visão clara de caixa, categorias e rotina operacional.
              </p>
              <p className="mt-3 max-w-sm text-sm text-white/70">
                Começamos pelo acesso e pela estrutura. Depois vem a parte divertida: parar de sofrer com planilha.
              </p>
              {!isMfaStep ? (
                <p className="mt-6 text-sm text-white/80">
                  Precisa redefinir a senha? Informe seu email e use o link ao lado do campo de senha.
                </p>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        Ao continuar, você concorda com os termos e a política de privacidade do Fluxora.
        {nextPath !== "/dashboard" ? (
          <>
            {" "}
            <Link href={nextPath} className="underline-offset-4 hover:underline">
              Após o login você volta para a rota solicitada.
            </Link>
          </>
        ) : null}
      </FieldDescription>
    </div>
  )
}
