import { CacheClearButton } from "../../components/CacheClearButton";
import { clearSomePageCache } from "./cache"; // Your page-specific cache clearing function

export default function SomePage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1>Page Title</h1>
        <CacheClearButton clearCache={clearSomePageCache} />
      </div>
      {/* Rest of your page content */}
    </div>
  );
}
