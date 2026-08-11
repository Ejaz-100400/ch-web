import { useEffect, useState } from "react";
import { api } from "./api";

/**
 * Car Make and Car Model filter dropdowns, each scoped to whichever the
 * other currently has selected -- pick a model first and the make list
 * narrows to makes that have it, and vice versa. Whenever the *other* side
 * changes and the current selection is no longer in the freshly-fetched
 * option list, it's cleared (rather than left pointing at a value the
 * <select> no longer renders as an option).
 */
export function useVehicleFilters() {
  const [carMake, setCarMake] = useState("");
  const [carModel, setCarModel] = useState("");
  const [carMakeOptions, setCarMakeOptions] = useState<string[]>([]);
  const [carModelOptions, setCarModelOptions] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    api.calls
      .carMakes(carModel || undefined)
      .then((res) => {
        if (!active) return;
        setCarMakeOptions(res);
        setCarMake((prev) => (prev && !res.includes(prev) ? "" : prev));
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
      .carModels(carMake || undefined)
      .then((res) => {
        if (!active) return;
        setCarModelOptions(res);
        setCarModel((prev) => (prev && !res.includes(prev) ? "" : prev));
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
    setCarMake("");
    setCarModel("");
  }

  return { carMake, setCarMake, carModel, setCarModel, carMakeOptions, carModelOptions, reset };
}
