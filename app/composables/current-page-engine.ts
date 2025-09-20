import type { RouteLocationNormalized } from "vue-router";
import type { NavigationItem } from "./types";

export const useCurrentNavigationIndex = (
  navigation: Array<NavigationItem>,
) => {
  const router = useRouter();
  const route = useRoute();

  const currentNavigation = ref(-1);

  function calculateCurrentNavIndex(to: RouteLocationNormalized) {
    const validOptions = navigation
      .map((e, i) => ({ ...e, index: i }))
      .filter((e) => to.fullPath.startsWith(e.prefix));
    const bestOption = validOptions
      .sort((a, b) => b.route.length - a.route.length)
      .at(0);

    return bestOption?.index ?? -1;
  }

  currentNavigation.value = calculateCurrentNavIndex(route);

  router.afterEach((to) => {
    currentNavigation.value = calculateCurrentNavIndex(to);
  });

  return currentNavigation;
};
