import { createControlTargetKey } from "@/tools/control";
import type { ControlTarget } from "@/types/control";
import { useLocalStorage } from "@vueuse/core";
import { computed } from "vue";

const CONTROL_FAVORITE_TARGETS_KEY = "mcsm_control_favorite_targets";
const CONTROL_TARGET_NOTES_KEY = "mcsm_control_target_notes";

export function useControlTargetFavorites() {
  const favoriteTargetKeys = useLocalStorage<string[]>(CONTROL_FAVORITE_TARGETS_KEY, []);
  const targetNotes = useLocalStorage<Record<string, string>>(CONTROL_TARGET_NOTES_KEY, {});

  const favoriteTargetKeySet = computed(() => new Set(favoriteTargetKeys.value));

  const isFavoriteTarget = (
    target?: Pick<ControlTarget, "daemonId" | "mode" | "instanceId">
  ) => {
    if (!target || target.mode !== "instance") return false;
    return favoriteTargetKeySet.value.has(createControlTargetKey(target));
  };

  const toggleFavoriteTarget = (target: ControlTarget) => {
    if (target.mode !== "instance") return;

    const targetKey = createControlTargetKey(target);
    if (favoriteTargetKeySet.value.has(targetKey)) {
      favoriteTargetKeys.value = favoriteTargetKeys.value.filter((item) => item !== targetKey);
      return;
    }

    favoriteTargetKeys.value = [...favoriteTargetKeys.value, targetKey];
  };

  const getTargetNote = (
    target?: Pick<ControlTarget, "daemonId" | "mode" | "instanceId">
  ) => {
    if (!target || target.mode !== "instance") return "";
    return String(targetNotes.value[createControlTargetKey(target)] || "").trim();
  };

  const setTargetNote = (target: ControlTarget, note: string) => {
    if (target.mode !== "instance") return;

    const targetKey = createControlTargetKey(target);
    const trimmedNote = note.trim();
    if (!trimmedNote) {
      const nextNotes = { ...targetNotes.value };
      delete nextNotes[targetKey];
      targetNotes.value = nextNotes;
      return;
    }

    targetNotes.value = {
      ...targetNotes.value,
      [targetKey]: trimmedNote
    };
  };

  const sortTargetsByFavorite = (targets: ControlTarget[]) => {
    const globals: ControlTarget[] = [];
    const favorites: ControlTarget[] = [];
    const normalTargets: ControlTarget[] = [];

    for (const target of targets) {
      if (target.mode === "global") {
        globals.push(target);
        continue;
      }

      if (isFavoriteTarget(target)) {
        favorites.push(target);
        continue;
      }

      normalTargets.push(target);
    }

    return [...globals, ...favorites, ...normalTargets];
  };

  return {
    favoriteTargetKeys,
    targetNotes,
    isFavoriteTarget,
    toggleFavoriteTarget,
    getTargetNote,
    setTargetNote,
    sortTargetsByFavorite
  };
}
