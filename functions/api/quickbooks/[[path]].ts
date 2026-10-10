interface Env { REFERRAL_API: Fetcher }
export const onRequest: PagesFunction<Env> = ({request,env}) => env.REFERRAL_API.fetch(request);
