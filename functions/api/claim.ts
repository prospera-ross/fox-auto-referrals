interface Env { REFERRAL_API: Fetcher }

// Service binding keeps the browser on the Pages origin and the API private.
export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  return env.REFERRAL_API.fetch(request);
};
