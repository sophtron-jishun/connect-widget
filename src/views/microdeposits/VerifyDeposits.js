import React, { useEffect, useReducer, useRef } from 'react'
import PropTypes from 'prop-types'
import { defer } from 'rxjs'

import { useTokens } from '@kyper/tokenprovider'
import { Text } from '@kyper/text'
import { Text as ProtectedText } from 'src/privacy/components'
import { Button } from '@kyper/button'
import { MessageBox } from '@kyper/messagebox'
import { TextInput } from 'src/privacy/input'

import { AriaLive } from 'src/components/AriaLive'
import { __ } from 'src/utilities/Intl'

import useAnalyticsPath from 'src/hooks/useAnalyticsPath'
import { PageviewInfo } from 'src/const/Analytics'

import { useForm } from 'src/hooks/useForm'
import { SlideDown } from 'src/components/SlideDown'
import { MicrodepositsStatuses } from 'src/views/microdeposits/const'
import { fadeOut } from 'src/utilities/Animation'
import connectAPI from 'src/services/api'

const schema = {
  firstAmount: {
    label: __('Amount 1'),
    pattern: 'number',
    required: true,
    min: 0.01,
    max: 0.09,
  },
  secondAmount: {
    label: __('Amount 2'),
    pattern: 'number',
    required: true,
    min: 0.01,
    max: 0.09,
  },
}
const ACTIONS = {
  SET_SUBMITTING: 'verifyDeposits/set_submitting',
  SUBMITTING_ERROR: 'verifyDeposits/submitting_error',
}
const reducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.SET_SUBMITTING:
      return { ...state, isSubmitting: true }
    case ACTIONS.SUBMITTING_ERROR:
      return { ...state, isSubmitting: false, submittingError: true }
    default:
      return state
  }
}

export const VerifyDeposits = ({ microdeposit, onSuccess }) => {
  const containerRef = useRef(null)
  useAnalyticsPath(...PageviewInfo.CONNECT_MICRODEPOSITS_VERIFY_DEPOSITS)
  const initialForm = { firstAmount: '', secondAmount: '' }
  const { handleTextInputChange, handleSubmit, values, errors } = useForm(
    () => dispatch({ type: ACTIONS.SET_SUBMITTING }),
    schema,
    initialForm,
  )
  const tokens = useTokens()
  const styles = getStyles(tokens)
  const [state, dispatch] = useReducer(reducer, { isSubmitting: false, submittingError: false })

  useEffect(() => {
    if (!state.isSubmitting) return () => {}

    const amountData = {
      deposit_amount_1: values.firstAmount.split('.')[1],
      deposit_amount_2: values.secondAmount.split('.')[1],
    }

    const verifyMicrodeposit$ = defer(() =>
      connectAPI.verifyMicrodeposit(microdeposit.guid, amountData),
    )

    const subscription = verifyMicrodeposit$.subscribe(
      () => fadeOut(containerRef.current, 'down').then(() => onSuccess()),
      () => dispatch({ type: ACTIONS.SUBMITTING_ERROR }),
    )

    return () => subscription.unsubscribe()
  }, [state.isSubmitting]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={containerRef}>
      <SlideDown>
        <div style={styles.header}>
          <Text as="H2" data-test="title-header" style={styles.title}>
            {__('Enter deposit amounts')}
          </Text>
          <ProtectedText as="Paragraph" data-test="deposit-paragraph" style={styles.subtitle}>
            {
              /* --TR: Full string "Please find the two small deposits less than a dollar each in your {accountName} account, and enter the amounts here." */
              __(
                'Please find the two small deposits less than a dollar each in your %1 account, and enter the amounts here.',
                microdeposit.account_name,
              )
            }
          </ProtectedText>
        </div>
      </SlideDown>

      {(microdeposit.status === MicrodepositsStatuses.DENIED || state.submittingError) && (
        <SlideDown>
          <MessageBox
            data-test="input-error-messagebox"
            role="alert"
            style={styles.messageBox}
            variant="error"
          >
            <Text as="ParagraphSmall" data-test="input-error-text">
              {state.submittingError
                ? __("We're unable to submit your deposit amounts. Please try again.")
                : __('One or more of the amounts was incorrect. Please try again.')}
            </Text>
          </MessageBox>
        </SlideDown>
      )}
      <form onSubmit={(e) => e.preventDefault()}>
        <SlideDown>
          <div style={styles.inputs}>
            <div style={styles.firstInput}>
              <TextInput
                autoComplete="off"
                data-test="amount-1-input"
                errorText={errors.firstAmount}
                label={schema.firstAmount.label}
                name="firstAmount"
                onChange={handleTextInputChange}
                placeholder="0.00"
                value={values.firstAmount}
              />
            </div>
            <div style={styles.secondInput}>
              <TextInput
                autoComplete="off"
                data-test="amount-2-input"
                errorText={errors.secondAmount}
                label={schema.secondAmount.label}
                name="secondAmount"
                onChange={handleTextInputChange}
                placeholder="0.00"
                value={values.secondAmount}
              />
            </div>
          </div>
        </SlideDown>

        <SlideDown>
          <Button
            data-test="continue-button"
            onClick={handleSubmit}
            style={styles.button}
            type="submit"
            variant="primary"
          >
            {__('Continue')}
          </Button>
        </SlideDown>
        <AriaLive level="assertive" message={Object.values(errors).join(', ')} />
      </form>
    </div>
  )
}

const getStyles = (tokens) => ({
  header: {
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    marginBottom: tokens.Spacing.XSmall,
  },
  subtitle: {
    marginBottom: tokens.Spacing.Medium,
  },
  messageBox: {
    marginBottom: tokens.Spacing.Large,
  },
  inputs: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: tokens.Spacing.Tiny,
  },
  firstInput: {
    marginRight: tokens.Spacing.Small,
    width: '100%',
  },
  secondInput: {
    width: '100%',
  },
  button: {
    marginTop: tokens.Spacing.XLarge,
    width: '100%',
  },
})

VerifyDeposits.propTypes = {
  microdeposit: PropTypes.object.isRequired,
  onSuccess: PropTypes.func.isRequired,
}
