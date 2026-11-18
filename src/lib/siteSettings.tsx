import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";

export type SiteSettings = {
  supportEmail: string | null;
  supportPhone: string | null;
  announcementActive: boolean;
  announcementText: string | null;
  announcementUrl: string | null;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
};

const DEFAULTS: SiteSettings = {
  supportEmail: "support@justplay.in",
  supportPhone: null,
  announcementActive: false,
  announcementText: null,
  announcementUrl: null,
  maintenanceMode: false,
  maintenanceMessage: null,
};

const Ctx = createContext<SiteSettings>(DEFAULTS);

/** Admin-managed site settings. Fails open: if the table can't be read, the site behaves normally. */
export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<SiteSettings>(DEFAULTS);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("support_email,support_phone,announcement_active,announcement_text,announcement_url,maintenance_mode,maintenance_message")
        .eq("id", true)
        .maybeSingle();
      if (cancelled || error || !data) return;
      setS({
        supportEmail: data.support_email,
        supportPhone: data.support_phone,
        announcementActive: data.announcement_active,
        announcementText: data.announcement_text,
        announcementUrl: data.announcement_url,
        maintenanceMode: data.maintenance_mode,
        maintenanceMessage: data.maintenance_message,
      });
    };
    void load();
    const t = setInterval(() => void load(), 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return <Ctx.Provider value={s}>{children}</Ctx.Provider>;
}

export function useSiteSettings() {
  return useContext(Ctx);
}
