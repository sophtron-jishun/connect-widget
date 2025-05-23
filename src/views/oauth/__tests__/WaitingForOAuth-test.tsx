import React from 'react'
import { render, screen, waitFor } from 'src/utilities/testingLibrary'
import { WaitingForOAuth } from 'src/views/oauth/WaitingForOAuth'
import { __ } from 'src/utilities/Intl'
import { ApiProvider } from 'src/context/ApiContext'
import { apiValue } from 'src/const/apiProviderMock'
import { OAUTH_STATE } from 'src/services/mockedData'

describe('WaitingForOAuth view', () => {
  describe('Button delay for try again', () => {
    const defaultProps = {
      institution: { guid: 'INS-123', name: 'MX Bank' },
      member: { guid: 'MBR-123' },
      onOAuthError: vi.fn(),
      onOAuthRetry: vi.fn(),
      onOAuthSuccess: vi.fn(),
      onReturnToSearch: vi.fn(),
    }

    it('should disable the buttons when the component loads', () => {
      render(<WaitingForOAuth {...defaultProps} />)
      const tryAgainButton = screen.getByRole('button', { name: 'Try again' })
      expect(
        screen.getByText(
          __(
            'You should have been directed to %1 to sign in and connect your account.',
            defaultProps.institution.name,
          ),
        ),
      ).toBeInTheDocument()
      expect(tryAgainButton).toBeDisabled()
    })

    it('should enable the tryAgain button after 2 seconds and call onOAuthRetry when clicked ', async () => {
      const { user } = render(<WaitingForOAuth {...defaultProps} />)
      const tryAgainButton = await screen.findByRole('button', { name: 'Try again' })
      await waitFor(
        async () => {
          expect(tryAgainButton).not.toBeDisabled()
          await user.click(tryAgainButton)
          expect(defaultProps.onOAuthRetry).toHaveBeenCalledTimes(1)
        },
        { timeout: 2500 },
      )
    })

    it('should call onOAuthSuccess if polling an oauth state was successful', async () => {
      render(<WaitingForOAuth {...defaultProps} />)
      await waitFor(
        async () => {
          expect(defaultProps.onOAuthSuccess).toHaveBeenCalledTimes(1)
        },
        { timeout: 3000 },
      )
    })

    it('should call onOAuthError if polling an oauth state was unsuccessful', async () => {
      const loadOAuthState = () =>
        Promise.resolve({ ...OAUTH_STATE.oauth_state, auth_status: 3, error_reason: 2 })
      render(
        <ApiProvider apiValue={{ ...apiValue, loadOAuthState }}>
          <WaitingForOAuth {...defaultProps} />
        </ApiProvider>,
      )
      await waitFor(
        async () => {
          expect(defaultProps.onOAuthError).toHaveBeenCalledTimes(1)
        },
        { timeout: 3000 },
      )
    })
  })
})
