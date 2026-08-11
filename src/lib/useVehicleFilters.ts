import { useEffect, useState } from "react";
import { api } from "./api";

/**
 * Car Make and Car Model filter dropdowns, each scoped to whichever the
 * other currently has selected -- pick one or more models and the make list
 * narrows to makes that have any of them, and vice versa. Whenever the
 * *other* side changes and the current selection includes values no longer
 * in the freshly-fetched option list, those are dropped (rather than left
 * pointing at values the dropdown no longer renders as options).
 *
 * Prune helpers return the *same array reference* when nothing was actually
 * removed -- returning a fresh (but equal-content) array from a state setter
 * would still change identity, which would re-trigger the other side's
 * effect and the two could ping-pong indefinitely.
 */
function pruneToOptions(current: string[], options: string[]): string[] {
  const kept = current.filter((v) => options.includes(v));
  return kept.length === current.length ? current : kept;
}

export function useVehicleFilters() {
  const [carMake, setCarMake] = useState<string[]>([]);
  const [carModel, setCarModel] = useState<string[]>([]);
  const [carMakeOptions, setCarMakeOptions] = useState<string[]>([]);
  const [carModelOptions, setCarModelOptions] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    api.calls
      .carMakes(carModel.length ? carModel : undefined)
      .then((res) => {
        if (!active) return;
        setCarMakeOptions(res);
        setCarMake((prev) => pruneToOptions(prev, res));
      })
      .catch(() => {
        if (active) setCarMakeOptions([]);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carModel]);

  useEffect(() => {
    let active = true;
    api.calls
      .carModels(carMake.length ? carMake : undefined)
      .then((res) => {
        if (!active) return;
        setCarModelOptions(res);
        setCarModel((prev) => pruneToOptions(prev, res));
      })
      .catch(() => {
        if (active) setCarModelOptions([]);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carMake]);

  function reset() {
    setCarMake([]);
    setCarModel([]);
  }

  return { carMake, setCarMake, carModel, setCarModel, carMakeOptions, carModelOptions, reset };
}
