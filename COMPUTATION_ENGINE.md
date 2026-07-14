# Computation Engine Specifications
**Version**: v1.6.1 (Build 000023)  
**System**: I AM CHOSEN International  
**Reference Manual**: Official Business System & Compensation Plan Manual Version 3.0  

---

## 1. Centralized Exchange Configuration
All calculations involving conversion between Chosen Credits (CC) and Philippine Pesos (PHP) are driven dynamically from a centralized database document:

- **Firestore Path**: `system_config/cc_settings`
- **Fields**:
  - `cashInRatePHP` (default: `70`): The PHP cost of purchasing 1 CC.
  - `cashOutRatePHP` (default: `69`): The PHP redemption value of 1 CC.
  - `currency` (default: `"PHP"`): The standard denomination currency.

---

## 2. Cash-In (Deposit / Procurement) Formulas
When a customer tops up their Chosen Wallet with CC, the required PHP deposit is calculated as:

$$\text{PHP Amount} = \text{CC Amount} \times \text{cashInRatePHP}$$

$$\text{CC Credited} = \frac{\text{PHP Paid}}{\text{cashInRatePHP}}$$

### Example:
- Default Rate: $1\text{ CC} = ₱70.00\text{ PHP}$
- To receive $50\text{ CC}$ (Bronze package activation cost):
  $$50\text{ CC} \times 70 = ₱3,500.00\text{ PHP}$$

---

## 3. Cash-Out (Withdrawal / Redemption) Formulas
When an Affiliate withdraws earnings from their Commission Wallet, the platform applies a $10\%$ Withholding Tax and a flat Administrative Fee equivalent to $1\text{ CC}$ (calculated at the standard Cash-In rate of ₱70.00).

### Official Calculations:
1. **Gross PHP amount**:
   $$\text{Gross PHP} = \text{Withdrawal CC} \times \text{cashOutRatePHP}$$
2. **Withholding Tax ($10\%$)**:
   $$\text{Withholding Tax PHP} = \text{Gross PHP} \times 0.10$$
3. **Administrative Fee (Flat)**:
   $$\text{Admin Fee PHP} = ₱70.00\text{ PHP}$$
4. **Net Proceeds (PHP)**:
   $$\text{Net Proceeds PHP} = \text{Gross PHP} - \text{Withholding Tax PHP} - \text{Admin Fee PHP}$$

### Example:
- Withdrawal of $100\text{ CC}$ at default rates ($1\text{ CC} = ₱69.00\text{ PHP}$):
  - **Gross PHP**: $100\text{ CC} \times 69 = ₱6,900.00\text{ PHP}$
  - **Withholding Tax**: $₱6,900.00 \times 0.10 = ₱690.00\text{ PHP}$
  - **Admin Fee**: $₱70.00\text{ PHP}$
  - **Net Proceeds**: $6,900.00 - 690.00 - 70.00 = ₱6,140.00\text{ PHP}$

---

## 4. Affiliate Package Purchase Tier Levels
When purchasing packages to upgrade accounts or activate tracks, the CC pricing is fixed as follows:

| Package Tier | CC Cost | PHP Equivalent (at ₱70.00/CC) |
| :--- | :--- | :--- |
| **Bronze** | 50 CC | ₱3,500.00 PHP |
| **Silver** | 350 CC | ₱24,500.00 PHP |
| **Gold** | 1,500 CC | ₱105,000.00 PHP |
| **Platinum** | 3,000 CC | ₱210,000.00 PHP |
| **Diamond** | 5,000 CC | ₱350,000.00 PHP |
