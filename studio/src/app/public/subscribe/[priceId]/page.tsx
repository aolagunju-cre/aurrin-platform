import { SubscribeCheckout } from '../../../../components/public/SubscribeCheckout';

export default async function SubscribePage(
  { params }: { params: Promise<{ priceId: string }> }
): Promise<React.ReactElement> {
  const { priceId } = await params;
  return <SubscribeCheckout priceId={priceId} />;
}
