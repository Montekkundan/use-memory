export default defineNuxtRouteMiddleware(async (to) => {
  try {
    await $fetch("/api/admin/session", {
      headers: import.meta.server
        ? useRequestHeaders(["cookie"])
        : undefined,
    });
  }
  catch (error) {
    const failure = error as {
      statusCode?: number;
      response?: { status?: number };
    };
    const status = failure.statusCode ?? failure.response?.status;
    if (status === 401) {
      return navigateTo({
        path: "/login",
        query: { redirect: to.fullPath },
      });
    }
    return navigateTo("/home");
  }
});
