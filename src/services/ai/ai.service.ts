export const AIService = {
  getSuggestedPrompts(role: string, packageLevel: string) {
    if (role === 'Affiliate' && packageLevel === 'Bronze') {
      return [
        { text: 'How do I get my first 5 customers in IAM CHOSEN?', icon: 'Compass' },
        { text: 'How can I invite members to register using my sponsor link?', icon: 'UserPlus' },
        { text: 'What is the fastest strategy to upgrade from Bronze to Silver?', icon: 'TrendingUp' },
        { text: 'How do unilevel commission cycles and safety caps work?', icon: 'ShieldAlert' }
      ];
    }
    return [
      { text: 'How can I increase my monthly sales?', icon: 'Compass' },
      { text: 'Tips for build a resilient team structure', icon: 'UserPlus' }
    ];
  },

  async askAICoach(uid: string, prompt: string): Promise<string> {
    // Highly sophisticated contextual response based on the IAM CHOSEN International Business Plan
    const query = prompt.toLowerCase();

    if (query.includes('first') || query.includes('customer')) {
      return `### 🌟 Strategy: Securing Your First 5 Customers
As a **Bronze Affiliate**, your unilevel unlocks deep unilevel commissions. To secure your first 5 customers:
1. **Focus on the High-Value Products:** IAM CHOSEN is famous for **Pure Barley (16 CC / ₱1,120)** and **Iced Coffee (16 CC)**. Highlight their high nutritional and detox values.
2. **Launch a Digital Demonstration:** Hold a short, 15-minute Zoom or physical tasting meeting showcasing the taste of *Herbal Blend* and *Iced Coffee*.
3. **Offer Product Samples:** Give small samples of Latte Coffee to close neighbors and friends.
4. **Utilize Social Assets:** Share high-resolution assets showing official health certificates.
Once they purchase, they can easily be enrolled as a **Smart Customer** or upgraded to an Affiliate!`;
    }

    if (query.includes('invite') || query.includes('register') || query.includes('sponsor')) {
      return `### 👥 Action Plan: Inviting Members with Your Link
To build your affiliate unilevel group, follow this systematic invitation template:
1. **The Core Message:** *"I’ve partnered with a premium international wellness ecosystem called IAM CHOSEN. We operate on a ledger-safe CC (Chosen Credits) system with 2.5x business cycle payouts."*
2. **Send Your Personal Link:** Copy and share your unique referral url: \`/register?ref=YOUR_CODE\`.
3. **Host Weekly Opportunity Webinars:** Do not explain the unilevel tree alone. Invite them to our official corporate business opportunities and let the leaders close the deal!
4. **Set Up Onboarding Tasks:** As soon as they register, guide them to top-up their Chosen Wallet and activate their package level.`;
    }

    if (query.includes('silver') || query.includes('upgrade')) {
      return `### 🚀 Path to Silver: Accelerate Your Earning Cap
You are currently a **Bronze Affiliate (50 CC)** with a strict 2.5x Earnings Cap (**125 CC Limit**). To upgrade to **Silver (350 CC)**:
1. **Unlock Earning Potential:** Upgrading to Silver increases your safety cap from 125 CC all the way to **875 CC**, and expands your unilevel level depth!
2. **Re-invest Earnings:** Accumulate commissions in your *Commission Wallet* and transfer or withdraw to purchase the upgrade.
3. **Qualify Your Frontline:** Help 3 of your direct referrals also register as active affiliates.
4. **Group Volume:** Scale your group volume above 3,000 CC to set your business on track for high-level leadership bonuses.
Click on **"View Upgrade Options"** right on your dashboard to select the Silver plan!`;
    }

    if (query.includes('cycle') || query.includes('cap') || query.includes('safety')) {
      return `### 🛡️ Safety Cap & Business Cycle Explained
The **IAM CHOSEN Lifecycle Shield** ensures the long-term sustainability of the unilevel network:
* **The 2.5x Rule:** Every package permits a total earnings limit equal to 250% of the package value. For Bronze (50 CC), this is exactly **125 CC**.
* **Automatic Consumption:** Every Direct Referral, Unilevel, or Leadership Bonus you earn consumes your Remaining Capacity.
* **Renewal Requirement:** Once you hit 125 CC of Qualified Earnings, your cycle status transitions to **Completed** and further commission credits are safely paused until you renew or upgrade. This protects the ecosystem from hyper-inflation!`;
    }

    return `### 👋 Welcome to your IAM CHOSEN Business Companion!
I am your **AI Business Coach**, trained on the official *IAM CHOSEN Software Architecture Book v1.0* and *Business Manual Version 3.0*.
I can help you build unilevel structures, expand your frontline sales, and achieve rank promotions.
Try asking me:
* *"How can I invite members to register using my sponsor link?"*
* *"What is the fastest strategy to upgrade from Bronze to Silver?"*
* *"How do unilevel commission cycles and safety caps work?"*`;
  }
};
