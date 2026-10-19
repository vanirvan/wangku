import {
  AiConfigSection,
  DangerZoneSection,
  DeviceSessionsSection,
  ThirdPartyLoginSection,
  YourDataSection,
} from "@/components/features/settings";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 pb-10">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Manage your account settings and preferences.
        </p>
      </div>

      <Separator />

      <ThirdPartyLoginSection />

      <Separator />

      <DeviceSessionsSection />

      <Separator />

      <AiConfigSection />

      <Separator />

      <YourDataSection />

      <Separator />

      <DangerZoneSection />
    </div>
  );
}
