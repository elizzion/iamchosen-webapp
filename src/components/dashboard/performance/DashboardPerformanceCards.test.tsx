import { UserProfile } from '../../../types';
import { SMART_CUSTOMER_PACKAGES, AFFILIATE_PACKAGES, evaluateCardVisibility } from './DashboardPerformanceCards';

export interface TestCaseResult {
  id: number;
  description: string;
  input: { accountType: string; packageLevel: string };
  expected: { showSmartCustomer: boolean; showAffiliate: boolean; showNetwork: boolean; isInvalid: boolean };
  actual: { showSmartCustomer: boolean; showAffiliate: boolean; showNetwork: boolean; isInvalid: boolean };
  passed: boolean;
}

export const RUN_DASHBOARD_PERFORMANCE_TESTS = (): TestCaseResult[] => {
  const cases = [
    // 1. Customer + None shows neither card
    {
      id: 1,
      description: "Customer + None shows neither card",
      accountType: "Customer",
      packageLevel: "None",
      expected: { showSmartCustomer: false, showAffiliate: false, showNetwork: false, isInvalid: false }
    },
    // 2. Smart Customer + Bronze shows only Smart Customer Card
    {
      id: 2,
      description: "Smart Customer + Bronze shows only Smart Customer Card",
      accountType: "Smart Customer",
      packageLevel: "Bronze",
      expected: { showSmartCustomer: true, showAffiliate: false, showNetwork: false, isInvalid: false }
    },
    // 3. Smart Customer + Silver shows only Smart Customer Card
    {
      id: 3,
      description: "Smart Customer + Silver shows only Smart Customer Card",
      accountType: "Smart Customer",
      packageLevel: "Silver",
      expected: { showSmartCustomer: true, showAffiliate: false, showNetwork: false, isInvalid: false }
    },
    // 4. Smart Customer + Gold shows only Smart Customer Card
    {
      id: 4,
      description: "Smart Customer + Gold shows only Smart Customer Card",
      accountType: "Smart Customer",
      packageLevel: "Gold",
      expected: { showSmartCustomer: true, showAffiliate: false, showNetwork: false, isInvalid: false }
    },
    // 5. Smart Customer + Platinum shows only Smart Customer Card
    {
      id: 5,
      description: "Smart Customer + Platinum shows only Smart Customer Card",
      accountType: "Smart Customer",
      packageLevel: "Platinum",
      expected: { showSmartCustomer: true, showAffiliate: false, showNetwork: false, isInvalid: false }
    },
    // 6. Smart Customer + Diamond shows only Smart Customer Card
    {
      id: 6,
      description: "Smart Customer + Diamond shows only Smart Customer Card",
      accountType: "Smart Customer",
      packageLevel: "Diamond",
      expected: { showSmartCustomer: true, showAffiliate: false, showNetwork: false, isInvalid: false }
    },
    // 7. Affiliate + Bronze shows only Affiliate Rank Card
    {
      id: 7,
      description: "Affiliate + Bronze shows only Affiliate Rank Card",
      accountType: "Affiliate",
      packageLevel: "Bronze",
      expected: { showSmartCustomer: false, showAffiliate: true, showNetwork: true, isInvalid: false }
    },
    // 8. Affiliate + Silver shows only Affiliate Rank Card
    {
      id: 8,
      description: "Affiliate + Silver shows only Affiliate Rank Card",
      accountType: "Affiliate",
      packageLevel: "Silver",
      expected: { showSmartCustomer: false, showAffiliate: true, showNetwork: true, isInvalid: false }
    },
    // 9. Affiliate + Gold shows only Affiliate Rank Card
    {
      id: 9,
      description: "Affiliate + Gold shows only Affiliate Rank Card",
      accountType: "Affiliate",
      packageLevel: "Gold",
      expected: { showSmartCustomer: false, showAffiliate: true, showNetwork: true, isInvalid: false }
    },
    // 10. Affiliate + Platinum shows only Affiliate Rank Card
    {
      id: 10,
      description: "Affiliate + Platinum shows only Affiliate Rank Card",
      accountType: "Affiliate",
      packageLevel: "Platinum",
      expected: { showSmartCustomer: false, showAffiliate: true, showNetwork: true, isInvalid: false }
    },
    // 11. Affiliate + Diamond shows only Affiliate Rank Card
    {
      id: 11,
      description: "Affiliate + Diamond shows only Affiliate Rank Card",
      accountType: "Affiliate",
      packageLevel: "Diamond",
      expected: { showSmartCustomer: false, showAffiliate: true, showNetwork: true, isInvalid: false }
    },
    // 12. Affiliate + City Distributor shows only Affiliate Rank Card
    {
      id: 12,
      description: "Affiliate + City Distributor shows only Affiliate Rank Card",
      accountType: "Affiliate",
      packageLevel: "City Distributor",
      expected: { showSmartCustomer: false, showAffiliate: true, showNetwork: true, isInvalid: false }
    },
    // 13. Affiliate + Regional Distributor shows only Affiliate Rank Card
    {
      id: 13,
      description: "Affiliate + Regional Distributor shows only Affiliate Rank Card",
      accountType: "Affiliate",
      packageLevel: "Regional Distributor",
      expected: { showSmartCustomer: false, showAffiliate: true, showNetwork: true, isInvalid: false }
    },
    // 14. Affiliate never renders Smart Customer Card
    {
      id: 14,
      description: "Affiliate never renders Smart Customer Card",
      accountType: "Affiliate",
      packageLevel: "Bronze",
      expected: { showSmartCustomer: false, showAffiliate: true, showNetwork: true, isInvalid: false }
    },
    // 15. Smart Customer never renders Affiliate Rank Card
    {
      id: 15,
      description: "Smart Customer never renders Affiliate Rank Card",
      accountType: "Smart Customer",
      packageLevel: "Bronze",
      expected: { showSmartCustomer: true, showAffiliate: false, showNetwork: false, isInvalid: false }
    },
    // 16. Invalid combination: Customer + Bronze
    {
      id: 16,
      description: "Invalid account/package combinations show neither card (Customer + Bronze)",
      accountType: "Customer",
      packageLevel: "Bronze",
      expected: { showSmartCustomer: false, showAffiliate: false, showNetwork: false, isInvalid: true }
    },
    // 17. Invalid combination: Smart Customer + None
    {
      id: 17,
      description: "Invalid account/package combinations show neither card (Smart Customer + None)",
      accountType: "Smart Customer",
      packageLevel: "None",
      expected: { showSmartCustomer: false, showAffiliate: false, showNetwork: false, isInvalid: true }
    },
    // 18. Invalid combination: Affiliate + None
    {
      id: 18,
      description: "Invalid account/package combinations show neither card (Affiliate + None)",
      accountType: "Affiliate",
      packageLevel: "None",
      expected: { showSmartCustomer: false, showAffiliate: false, showNetwork: false, isInvalid: true }
    }
  ];

  return cases.map(c => {
    const mockProfile = {
      uid: "mock-uid",
      accountType: c.accountType,
      packageLevel: c.packageLevel
    } as unknown as UserProfile;

    const actual = evaluateCardVisibility(mockProfile);

    const passed =
      actual.showSmartCustomerCard === c.expected.showSmartCustomer &&
      actual.showAffiliateCard === c.expected.showAffiliate &&
      actual.showNetworkCard === c.expected.showNetwork &&
      actual.isInvalid === c.expected.isInvalid;

    return {
      id: c.id,
      description: c.description,
      input: { accountType: c.accountType, packageLevel: c.packageLevel },
      expected: c.expected,
      actual: {
        showSmartCustomer: actual.showSmartCustomerCard,
        showAffiliate: actual.showAffiliateCard,
        showNetwork: actual.showNetworkCard,
        isInvalid: actual.isInvalid
      },
      passed
    };
  });
};
