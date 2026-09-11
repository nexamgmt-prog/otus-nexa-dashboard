/** Columns the browser may read. Secrets stay on the server. */

export const APP_USERS_PUBLIC_SELECT =
  "id,name,email,role,company,modules,client_slug,locale_preference,avatar_url,hero_clocks";

export const CLIENTS_PUBLIC_SELECT =
  "id,name,slug,logo_url,logo_light_url,hero_image_url,primary_color,active,default_locale,api_enabled,api_config,whatsapp_config,dashboard_cards,enabled_modules,account_id,created_at";
