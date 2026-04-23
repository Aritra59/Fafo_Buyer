/**
 * @param {{ id?: string, status?: string } & Record<string, unknown>} order
 */
export function triggerReadyNotification(order) {
  void order;
  alert("Your order is ready for pickup!");
}
