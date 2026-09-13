import { validateDemoContract } from "../src/components/command-center/demo/demo-contract";
import { capabilities, CURRENT_SURFACES } from "../src/content/command-center";

const errors = validateDemoContract();
if (errors.length) throw new Error(`Command Center demo contract failures:\n${errors.join("\n")}`);
if (!capabilities.some((capability) => capability.id === "subscriptions"))
  throw new Error("Command Center capability catalog is missing recurring subscriptions");
if (new Set(CURRENT_SURFACES.map((surface) => surface.n)).size !== CURRENT_SURFACES.length)
  throw new Error("Command Center current surfaces must have unique numbers");

console.log(
  JSON.stringify(
    {
      result: "passed",
      checks: [
        "rail capability coverage",
        "scenario destinations",
        "integration registry parity",
        "fictional relationship integrity",
      ],
    },
    null,
    2,
  ),
);
