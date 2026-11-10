# Location manager guide

[RU](manager-guide.ru.md) · [VI](manager-guide.vi.md)

You work in the same app as the clients: open the bot → «Rent a bike» → **Profile → Manager mode**. The item appears only after the administrator has assigned you as a location manager (by your Telegram ID). The bot sends you new bookings and, at 20:00, the list of tomorrow's handovers; the button in the message opens manager mode.

## Tabs

- **Today** — today's «Handovers» and «Returns». Late ones are marked «Overdue»; cash bookings show the amount due. The list refreshes on its own.
- **Fleet** — the location's bikes: status, mileage, repair.

## Find a booking

- **Scan QR** — point the camera at the QR on the client's screen.
- If the camera does not open, type the **Booking code** (for example BK-10001) and tap «Find booking».

The booking card shows the client, phone, dates, model, payment and the client's documents.

## Client documents

Compare the originals (passport, licence, international driving permit IDP) with the uploaded copies using «Open». An administrator reviews and decides on each document; the result shows on the card. A file link works for 10 minutes. If there are no copies, check the originals on site.

A foreigner needs a national licence plus an IDP under the 1968 Vienna Convention, category A1 (up to 125 cc) or A (150 cc and above).

## Bike handover

1. In the booking — **Bike handover**.
2. **Bike** — pick the exact bike by plate from the free bikes of this model (it may differ from the one the system reserved).
3. **Mileage, km** and **Fuel**.
4. **Bike photos** — 4 to 8 photos from all sides.
5. **Damage before handover** — scratches and chips that are already there.
6. **Create handover act** — the act is sent to the client.
7. The client confirms the act in their app. Tap **Check confirmation**: «The client confirmed the act. Bike handed over.» — hand over the key only after that.

## Cash

If the client pays on pick-up: **Cash payment** → amount («Full amount» fills in the remainder) → **For**: rental, deposit, prepayment or surcharge → **Accept cash**.

## Bike return

1. Find the booking (QR or code) → **Bike return**.
2. **Mileage at return, km**, **Fuel**, **Return photos**, **Damage** — anything new since the handover.
3. **Late return** is calculated automatically: up to 1 hour is free, then an hourly surcharge from the settings.
4. **Deposit deductions** — «Add deduction»: amount, reason, damage photo. Deductions cannot exceed the deposit.
5. Check the totals: **Deposit to refund** and **Surcharge to collect**.
6. **Accept and close booking** — the booking becomes «Completed». Take a cash surcharge through «Cash payment» → «Surcharge».

## The client did not come

If the client does not show up for the handover: in the booking **No-show** → **Mark no-show**. The booking is cancelled; the refund follows the cancellation rules. Three hours after the start the system cancels such a booking by itself.

## Repair

**Fleet** tab → bike → **Send to repair**, set **Ready by** (optional). Until that date the bike is not offered for booking. Fixed — **Back in service**.

## If something goes wrong

| Situation | What to do |
|---|---|
| The client says they paid, but the booking is «Awaiting payment» | Wait a minute — the status updates by itself. Do not hand over a bike without «Confirmed». If it does not update, message the administrator. |
| No free bike of the model | Tell the administrator — they will reassign the booking or contact the client. |
| QR from another location | The app shows an error: the booking belongs to another location. |
| The client reported a problem on the road | The bot sends you a message; call the client using the phone in the booking. |

## Bike not at the location

The customer can report this in the app, and you can use the "This bike is not here" button in the booking. The booking is marked "Bike missing". Resolve it right away:

1. **An identical bike is free.** Choose another plate in the handover form: the case closes by itself.
2. **Another model is free.** Choose it in the "Bike not at the location" block and tap "Offer to the customer". If it costs more, the customer pays nothing extra. If it costs less, the difference goes to refund.
3. **The bike is here.** Tap "The bike is here". The administrator is told about it.
4. **Nothing to offer.** Tap "Cancel with a full refund" and transfer the money to the customer.

While the customer waits for an answer, "No-show" and the regular cancellation are closed. After 15 minutes without an answer, the administrator is notified and the customer can cancel on their own.
