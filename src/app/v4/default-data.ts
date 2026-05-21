import type { Order, Template } from './template-engine';

/**
 * Default layout — Plum POS per-item label format.
 *
 * Each item is its own physical label:
 *   centered #callnum (wide)
 *   ── dashed hr ──
 *   phone           orderClass    (two-column row, pad to col 32)
 *   email           refcode
 *   ── dashed hr ──
 *   Item: X of Y
 *   Time: HH:MM
 *   Date: MM/DD/YYYY
 *   ── dashed hr ──
 *   <itemName>
 *   - <modifier 1>
 *   - <modifier 2>
 *   ── dashed hr ──
 *   centered "Powered by Plum POS"
 *   cutter
 */
export const DEFAULT_LAYOUT: Template = {
  header: [
    { type: 'token', value: 'narrow' },
    { type: 'token', value: 'center' },
    { type: 'token', value: 'wide' },
    { type: 'text', value: '#' },
    { type: 'variable', value: 'callnum' },
    { type: 'newline', value: '10' },
    { type: 'token', value: 'left' },
    { type: 'token', value: 'narrow' },
    { type: 'hr', value: '-' },
    { type: 'variable', value: 'phone' },
    { type: 'pad', value: '32' },
    { type: 'variable', value: 'orderClass' },
    { type: 'newline', value: '10' },
    { type: 'variable', value: 'email' },
    { type: 'pad', value: '32' },
    { type: 'variable', value: 'refcode' },
    { type: 'newline', value: '10' },
    { type: 'hr', value: '-' },
    { type: 'text', value: 'Item: ' },
    { type: 'variable', value: 'currentPage' },
    { type: 'text', value: ' of ' },
    { type: 'variable', value: 'totalPages' },
    { type: 'newline', value: '10' },
    { type: 'text', value: 'Time: ' },
    { type: 'variable', value: 'time' },
    { type: 'newline', value: '10' },
    { type: 'text', value: 'Date: ' },
    { type: 'variable', value: 'date' },
    { type: 'newline', value: '10' },
    { type: 'hr', value: '-' },
  ],
  item: [
    { type: 'token', value: 'black' },
    { type: 'token', value: 'narrow' },
    { type: 'token', value: 'left' },
    { type: 'variable', value: 'itemName' },
    { type: 'newline', value: '10' },
  ],
  modifier: [
    { type: 'token', value: 'black' },
    { type: 'token', value: 'narrow' },
    { type: 'token', value: 'left' },
    { type: 'text', value: '- ' },
    { type: 'variable', value: 'itemName' },
    { type: 'newline', value: '10' },
  ],
  guest: [
    { type: 'token', value: 'narrow' },
    { type: 'variable', value: 'ifguest' },
    { type: 'newline', value: '10' },
  ],
  footer: [
    { type: 'token', value: 'narrow' },
    { type: 'hr', value: '-' },
    { type: 'token', value: 'center' },
    { type: 'text', value: 'Powered by Plum POS' },
    { type: 'newline', value: '10' },
    { type: 'token', value: 'cutter' },
  ],
  ifguest: [
    { type: 'text', value: 'For Guest: ' },
    { type: 'variable', value: 'guest' },
  ],
};

/** Compact minimalist preset. */
export const MINIMALIST_LAYOUT: Template = {
  header: [
    { type: 'token', value: 'narrow' },
    { type: 'token', value: 'black' },
    { type: 'text', value: 'KITCHEN ORDER - ' },
    { type: 'variable', value: 'orderClass' },
    { type: 'newline', value: '10' },
    { type: 'hr', value: '-' },
    { type: 'variable', value: 'created' },
    { type: 'newline', value: '10' },
    { type: 'text', value: 'Customer: ' },
    { type: 'variable', value: 'customer' },
    { type: 'newline', value: '10' },
    { type: 'hr', value: '-' },
  ],
  item: [
    { type: 'token', value: 'wide' },
    { type: 'variable', value: 'quantity' },
    { type: 'text', value: 'x ' },
    { type: 'variable', value: 'itemName' },
    { type: 'newline', value: '10' },
  ],
  modifier: [
    { type: 'token', value: 'narrow' },
    { type: 'text', value: '  + ' },
    { type: 'variable', value: 'itemName' },
    { type: 'newline', value: '10' },
  ],
  footer: [
    { type: 'hr', value: '-' },
    { type: 'token', value: 'narrow' },
    { type: 'text', value: 'System ID: ' },
    { type: 'variable', value: 'orderId' },
    { type: 'newline', value: '15' },
    { type: 'token', value: 'cutter' },
  ],
};

/** Bold kitchen-priority preset. */
export const KITCHEN_PRIORITY_LAYOUT: Template = {
  header: [
    { type: 'token', value: 'wide' },
    { type: 'token', value: 'red' },
    { type: 'token', value: 'center' },
    { type: 'text', value: 'RUSH ORDER #' },
    { type: 'variable', value: 'callnum' },
    { type: 'newline', value: '12' },
    { type: 'token', value: 'left' },
    { type: 'token', value: 'narrow' },
    { type: 'token', value: 'black' },
    { type: 'hr', value: '=' },
    { type: 'text', value: 'Type: ' },
    { type: 'variable', value: 'orderClass' },
    { type: 'text', value: ' | Ready: ' },
    { type: 'variable', value: 'readyTime' },
    { type: 'newline', value: '10' },
    { type: 'hr', value: '=' },
  ],
  item: [
    { type: 'token', value: 'wide' },
    { type: 'token', value: 'black' },
    { type: 'variable', value: 'quantity' },
    { type: 'text', value: ' ' },
    { type: 'variable', value: 'itemName' },
    { type: 'newline', value: '10' },
  ],
  modifier: [
    { type: 'token', value: 'wide' },
    { type: 'token', value: 'red' },
    { type: 'text', value: '  -> ' },
    { type: 'variable', value: 'itemName' },
    { type: 'newline', value: '10' },
  ],
  footer: [
    { type: 'newline', value: '15' },
    { type: 'token', value: 'cutter' },
  ],
};

export const PRESETS: Record<string, Template> = {
  default: DEFAULT_LAYOUT,
  minimalist: MINIMALIST_LAYOUT,
  kitchen_priority: KITCHEN_PRIORITY_LAYOUT,
};

export const PRESET_LABELS: Record<string, string> = {
  default: 'Plum POS Label',
  minimalist: 'Minimalist',
  kitchen_priority: 'Kitchen Red',
};

/** Sandbox order used by the live preview — matches the receipt image. */
export const INITIAL_MOCK_ORDER: Order = {
  callnum: '7829',
  customer: 'John Doe',
  phone: '(555) 123-4567',
  email: 'john.doe@example.com',
  orderClass: 'DELIVERY',
  refcode: 'UBW-9921D',
  time: '14:30',
  date: '10/12/2023',
  readyTime: '14:30',
  poweredBy: 'Plum POS',
  paid: true,
  items: [
    {
      itemName: 'Spicy Chicken Sandwich',
      quantity: 1,
      modifiers: [
        { itemName: 'No Mayo' },
        { itemName: 'Add Extra Pickles' },
        { itemName: 'Toasted Bun' },
      ],
    },
    {
      itemName: 'Large Fries',
      quantity: 1,
      modifiers: [{ itemName: 'Salted' }],
    },
    {
      itemName: 'Diet Coke',
      quantity: 1,
      modifiers: [],
    },
  ],
};

export interface VariableSpec {
  name: string;
  desc: string;
  context: 'Any' | 'Item/Modifier Only' | 'Labels Only';
}

export const VARIABLE_CATALOG: VariableSpec[] = [
  { name: 'alternate', desc: 'Alternate printer name when redirection exists', context: 'Any' },
  { name: 'callnum', desc: 'The sequential customer calling number', context: 'Any' },
  { name: 'created', desc: 'Order ticket creation time', context: 'Any' },
  { name: 'currentPage', desc: 'Label sequence page (used on multi-label stickers)', context: 'Labels Only' },
  { name: 'customer', desc: 'Name or identification details of the customer', context: 'Any' },
  { name: 'date', desc: 'Formatted date derived from readyTime or created timestamp', context: 'Any' },
  { name: 'destination', desc: 'Routing target (e.g., Dispatch / Expo Desk / Bar)', context: 'Any' },
  { name: 'email', desc: 'Customer contact email address', context: 'Any' },
  { name: 'guest', desc: 'The guest seat number assigned to specific item', context: 'Item/Modifier Only' },
  { name: 'guests', desc: 'Detailed guest identification list, if guest count > 1', context: 'Any' },
  { name: 'guestCount', desc: 'Total guests assigned under this transaction', context: 'Any' },
  { name: 'indent', desc: 'Layout alignment indent formatting blocks', context: 'Item/Modifier Only' },
  { name: 'itemName', desc: 'The specific title of food, beverage, or modifier', context: 'Item/Modifier Only' },
  { name: 'memo', desc: 'General prep or order packaging memo notes', context: 'Any' },
  { name: 'name', desc: 'Name identifier of the order profile', context: 'Any' },
  { name: 'onlineId', desc: 'ID generated by aggregated online delivery services', context: 'Any' },
  { name: 'onlineProvider', desc: 'Platform delivery aggregator (UberEats, GrubHub, etc.)', context: 'Any' },
  { name: 'originalReadyTime', desc: 'The initial scheduled preparation timeline', context: 'Any' },
  { name: 'orderClass', desc: 'The order flow classification (Delivery, Takeout, DineIn)', context: 'Any' },
  { name: 'orderId', desc: 'Internal software receipt transaction identification', context: 'Any' },
  { name: 'owner', desc: 'Printer target cluster owner', context: 'Any' },
  { name: 'paid', desc: 'Paid status, evaluates condition ifpaid or efpaid', context: 'Any' },
  { name: 'phone', desc: 'Customer contact phone number', context: 'Any' },
  { name: 'poweredBy', desc: 'Branded software footer acknowledgment tag', context: 'Any' },
  { name: 'quantity', desc: 'Physical numeric quantity ordered', context: 'Item/Modifier Only' },
  { name: 'readyTime', desc: 'Scheduled target handover time', context: 'Any' },
  { name: 'refcode', desc: 'Reference code printed on the label (e.g. delivery shorthand)', context: 'Any' },
  { name: 'source', desc: 'Operational point of sale origin (POS, Web, kiosk)', context: 'Any' },
  { name: 'sourceId', desc: 'Transaction source identifier reference code', context: 'Any' },
  { name: 'style', desc: 'Aesthetic class modifiers used dynamically', context: 'Any' },
  { name: 'tags', desc: 'Loopable list of order properties', context: 'Any' },
  { name: 'tagValue', desc: 'Dynamic descriptive tag payload attribute', context: 'Any' },
  { name: 'totalPages', desc: 'Sum total count of printable labels generated', context: 'Labels Only' },
  { name: 'text', desc: 'Item specific description or customer alterations', context: 'Item/Modifier Only' },
  { name: 'time', desc: 'Calculated string time metric', context: 'Any' },
  { name: 'vprinterName', desc: 'The logical visual printer name defined', context: 'Any' },
];

/** Core, always-present sections — used to mark dynamic sub-sections in the picker. */
export const CORE_SECTIONS = ['header', 'guest', 'item', 'modifier', 'footer'];
