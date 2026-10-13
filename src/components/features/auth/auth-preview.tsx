import { Iphone } from "@/components/ui/iphone";
import { Safari } from "@/components/ui/safari";

export function AuthPreview() {
  return (
    <div className="relative hidden w-full max-w-xl items-center justify-center p-4 lg:flex">
      <Safari url="wangku.app" className="w-full shadow-2xl" />
      <div className="absolute -bottom-4 -right-2 z-20 w-[30%] max-w-[180px] drop-shadow-2xl">
        <Iphone />
      </div>
    </div>
  );
}
