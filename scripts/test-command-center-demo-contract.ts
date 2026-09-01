import { validateDemoContract } from "../src/components/command-center/demo/demo-contract";

const errors = validateDemoContract();
if (errors.length) throw new Error(`Command Center demo contract failures:\n${errors.join("\n")}`);

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
