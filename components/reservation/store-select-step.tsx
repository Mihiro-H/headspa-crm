import type { StoreListItem } from "@/app/actions/stores";

interface StoreSelectStepProps {
  stores: StoreListItem[];
  onSelect: (storeId: number) => void;
}

export function StoreSelectStep({ stores, onSelect }: StoreSelectStepProps) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-heading text-xl text-primary-700">店舗を選択してください</h2>
      {stores.map((store) => (
        <button
          key={store.id}
          type="button"
          onClick={() => onSelect(store.id)}
          className="rounded-lg border border-neutral-200 bg-neutral-0 p-4 text-left shadow-sm transition-colors hover:border-primary-300"
        >
          <p className="font-medium text-neutral-800">{store.name}</p>
          {store.nearestStation && (
            <p className="mt-1 text-sm text-neutral-500">{store.nearestStation}</p>
          )}
          {store.address && <p className="mt-1 text-sm text-neutral-500">{store.address}</p>}
        </button>
      ))}
    </div>
  );
}
