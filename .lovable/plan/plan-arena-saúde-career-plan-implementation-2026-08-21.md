# Plan: Arena Saúde Career Plan Implementation

Implement the Career Plan (Plano de Carreira) section within the Networking tab and update the points accrual logic to match the new business rules.

## User Review Required
> [!IMPORTANT]
> The Career Plan involves monthly bonuses (R$ 300 to R$ 25,000) and specific rank advancement rules (e.g., "Master", "Bronze"). This plan focuses on the UI and the points accrual logic. Automatic rank promotion and bonus distribution are complex and might require manual admin oversight or a separate cron job; for now, I will implement the UI display and points logic.

## Proposed Changes

### Database & Backend
- Update `confirm_payment` RPC to grant points to the sponsor (1st level) when a direct referral makes a deposit.
- Points ratio is already set to R$ 50 = 5 points (defined in the PDF analysis previously).

### Components & UI
- **Networking Page (`src/routes/_authenticated/indicacoes.tsx`)**:
  - Add a new "Plano de Carreira" tab.
  - Display the career plan hierarchy using the reference image as inspiration.
  - Show the user's current points and progress towards the next rank.
  - Include the reference image or a high-fidelity recreation of the ranks.

## Technical Details
- **Points Accrual**: Modify `confirm_payment` to include `PERFORM public.credit_points(cur, points, 'referral', 'Pontos por indicação direta', pay.id)` for `lvl = 1`.
- **UI Components**: Use `Tabs`, `Card`, and `Progress` components from shadcn/ui.
- **Assets**: Use the uploaded image via `lovable-assets` for the visual reference.

## Verification Plan
- **Manual Verification**: Check the "Indicações" page to see the new "Plano de Carreira" tab.
- **Logic Verification**: Test a simulated deposit to ensure points are credited to both the user and their level 1 sponsor.
