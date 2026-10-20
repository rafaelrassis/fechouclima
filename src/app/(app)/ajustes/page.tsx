import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { DEFAULT_WA_TEMPLATE } from "@/lib/wa-template";
import { ensureReferralCode } from "@/actions/settings";
import { AccountSection } from "@/components/settings/account-section";
import { LegalLinks } from "@/components/legal/legal-links";
import { BrandColorForm } from "@/components/settings/brand-color-form";
import { brandOrDefault } from "@/lib/brand";
import { PixForm } from "@/components/settings/pix-form";
import { PushToggle } from "@/components/settings/push-toggle";
import { LogoForm } from "@/components/settings/logo-form";
import { EmailDigestToggle } from "@/components/settings/email-digest-toggle";
import { DefaultReminderForm } from "@/components/settings/default-reminder-form";
import { ReferralCard } from "@/components/settings/referral-card";
import { WaTemplateForm } from "@/components/settings/wa-template-form";
import { NudgeTemplateForm } from "@/components/settings/nudge-template-form";
import { ApprovalWaTemplateForm } from "@/components/settings/approval-wa-template-form";
import { DEFAULT_NUDGE_TEMPLATE } from "@/lib/followup";
import Link from "next/link";
import { DEFAULT_APPROVAL_WA_TEMPLATE } from "@/lib/wa-template";

export const metadata = { title: "Ajustes" };

export default async function AjustesPage() {
  const userId = await requireUserId();
  const [user, referralCode, referralCount] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        name: true,
        companyName: true,
        waTemplate: true,
        nudgeTemplate: true,
        approvalWaTemplate: true,
        emailDigest: true,
        logoUpdatedAt: true,
        pixKey: true,
        pixKeyType: true,
        pixCity: true,
        brandColor: true,
        defaultReminderMonths: true,
        isAdmin: true,
      },
    }),
    ensureReferralCode(),
    db.user.count({ where: { referredById: userId } }),
  ]);
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Ajustes</h1>
      <LogoForm logoUrl={user.logoUpdatedAt ? `/api/logo?v=${user.logoUpdatedAt.getTime()}` : null} />
      <BrandColorForm initial={brandOrDefault(user.brandColor)} />
      <PixForm initialKey={user.pixKey ?? ""} initialType={user.pixKeyType ?? ""} initialCity={user.pixCity ?? ""} />
      <PushToggle />
      <EmailDigestToggle initial={user.emailDigest} />
      <WaTemplateForm initial={user.waTemplate ?? DEFAULT_WA_TEMPLATE} sender={user.companyName ?? user.name} />
      <NudgeTemplateForm initial={user.nudgeTemplate ?? DEFAULT_NUDGE_TEMPLATE} sender={user.companyName ?? user.name} />
      <ApprovalWaTemplateForm
        initial={user.approvalWaTemplate ?? DEFAULT_APPROVAL_WA_TEMPLATE}
        sender={user.companyName ?? user.name}
      />
      <DefaultReminderForm initial={user.defaultReminderMonths} />
      {referralCode.ok && <ReferralCard link={`${baseUrl}/cadastro?ref=${referralCode.data.code}`} count={referralCount} />}
      {user.isAdmin && (
        <Link href="/admin" className="flex h-11 items-center justify-center rounded-md border border-input text-sm font-semibold">
          Painel admin
        </Link>
      )}
      <AccountSection />
      <LegalLinks />
    </div>
  );
}
