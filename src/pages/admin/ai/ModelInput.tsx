import type { Provider } from "@/features/admin/aiAdminApi";
import ModelPicker from "../ModelPicker";

/** Model selector bound to a provider's model list. */
const ModelInput = ({ provider, value, onChange, className, liveOnly }: { provider?: Provider; value: string; onChange: (v: string) => void; className?: string; liveOnly?: boolean }) => (
  <ModelPicker models={provider?.models ?? []} value={value} onChange={onChange} className={className} liveOnly={liveOnly} />
);

export default ModelInput;
