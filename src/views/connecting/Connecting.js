import React, { useEffect, useState, useRef, useContext } from 'react'
import PropTypes from 'prop-types'
import { defer, of } from 'rxjs'
import {
  filter,
  take,
  pluck,
  tap,
  mergeMap,
  concatMap,
  catchError,
  map,
  retry,
} from 'rxjs/operators'
import { useSelector, useDispatch } from 'react-redux'

import { Text } from '@kyper/mui'
import { useTokens } from '@kyper/tokenprovider'

import { SlideDown } from 'src/components/SlideDown'
import { getDelay } from 'src/utilities/getDelay'
import { pollMember, CONNECTING_MESSAGES } from 'src/utilities/pollers'
import { STEPS, VERIFY_MODE } from 'src/const/Connect'
import { ConnectLogoHeader } from 'src/components/ConnectLogoHeader'
import { ProgressBar } from 'src/views/connecting/progress/ProgressBar'
import * as JobSchedule from 'src/utilities/JobSchedule'
import { AriaLive } from 'src/components/AriaLive'
import useAnalyticsPath from 'src/hooks/useAnalyticsPath'
import { useApi } from 'src/context/ApiContext'
import {
  getCurrentMember,
  getSelectedInstitutionUcpInstitutionId,
} from 'src/redux/selectors/Connect'
import { isConnectComboJobsEnabled } from 'src/redux/reducers/userFeaturesSlice'

import { ErrorStatuses, ReadableStatuses } from 'src/const/Statuses'

import {
  connectComplete,
  initializeJobSchedule,
  jobComplete,
  ActionTypes,
} from 'src/redux/actions/Connect'
import PostMessage from 'src/utilities/PostMessage'

import { fadeOut } from 'src/utilities/Animation'
import { __ } from 'src/utilities/Intl'
import { PageviewInfo, AuthenticationMethods } from 'src/const/Analytics'
import { POST_MESSAGES } from 'src/const/postMessages'
import { hasNoSingleAccountSelectOptions, hasNoVerifiableAccounts } from 'src/utilities/memberUtils'
import { AnalyticContext } from 'src/Connect'
import { PostMessageContext } from 'src/ConnectWidget'

export const Connecting = (props) => {
  const {
    connectConfig,
    institution,
    uiMessageVersion,
    hasAtriumAPI,
    isMobileWebview,
    onUpsertMember,
  } = props
  const currentMember = useSelector((state) => getCurrentMember(state))
  const isComboJobsEnabled = useSelector((state) => isConnectComboJobsEnabled(state))
  const jobSchedule = useSelector((state) => state.connect.jobSchedule)
  useAnalyticsPath(...PageviewInfo.CONNECT_CONNECTING, {
    authentication_method: currentMember.is_oauth
      ? AuthenticationMethods.OAUTH
      : AuthenticationMethods.NON_OAUTH,
  })
  const tokens = useTokens()
  const styles = getStyles(tokens)
  const getNextDelay = getDelay()
  const dispatch = useDispatch()

  const ucpInstitutionId = useSelector(getSelectedInstitutionUcpInstitutionId)

  const analyticFunctions = useContext(AnalyticContext)
  const postMessageFunctions = useContext(PostMessageContext)
  const connectingRef = useRef(null)
  const { api } = useApi()

  const [message, setMessage] = useState(CONNECTING_MESSAGES.STARTING)
  const [timedOut, setTimedOut] = useState(false)
  const [connectingError, setConnectingError] = useState(null)

  const activeJob = JobSchedule.getActiveJob(jobSchedule)
  const needsToInitializeJobSchedule = jobSchedule.isInitialized === false

  function handleMemberPoll(pollingState) {
    // If we have been polling for more than 15 attempts (60 seconds)
    // show the timeout message
    // Unless this is a PENDING member, then we don't show the timeout
    // since PENDING may take much longer to resolve.
    if (
      pollingState.pollingCount > 15 &&
      pollingState.currentResponse?.connection_status !== ReadableStatuses.PENDING
    ) {
      setTimedOut(true)
    }

    const statusChanged =
      pollingState.previousResponse?.connection_status !==
        pollingState.currentResponse?.connection_status ||
      pollingState.previousResponse?.raw_status !== pollingState.currentResponse?.raw_status

    // if status changes during connecting or timeout send out a post message
    if (pollingState.previousResponse != null && statusChanged) {
      const eventMetadata = {
        member_guid: pollingState.currentResponse.guid,
        user_guid: pollingState.currentResponse.user_guid,
        connection_status: pollingState.currentResponse.connection_status,
      }
      if (pollingState.currentResponse.aggregator) {
        eventMetadata.aggregator = pollingState.currentResponse.aggregator
      }
      if (pollingState.currentResponse.raw_status) {
        eventMetadata.raw_status = pollingState.currentResponse.raw_status
      }
      if (pollingState.currentResponse.selected_account_id) {
        eventMetadata.selected_account_id = pollingState.currentResponse.selected_account_id
      }
      if (ucpInstitutionId) {
        eventMetadata.ucpInstitutionId = ucpInstitutionId
      }
      postMessageFunctions.onPostMessage('connect/memberStatusUpdate', eventMetadata)
    }

    setMessage(pollingState.userMessage)
  }

  // If all jobs are done, fade out and move onto the connected step
  useEffect(() => {
    if (!needsToInitializeJobSchedule && JobSchedule.areAllJobsDone(jobSchedule)) {
      // give the animation a bit more time for the user to see the complete
      // state

      // send member connected post message before analytic event, this allows clients to show their own "connected" window before the connect complete step.
      const eventMetadata = {
        member_guid: currentMember.guid,
        user_guid: currentMember.user_guid,
      }

      if (currentMember.aggregator) {
        eventMetadata.aggregator = currentMember.aggregator
      }

      if (currentMember.selected_account_id) {
        eventMetadata.selected_account_id = currentMember.selected_account_id
      }

      if (currentMember.raw_status) {
        eventMetadata.raw_status = currentMember.raw_status
      }

      if (ucpInstitutionId) {
        eventMetadata.ucpInstitutionId = ucpInstitutionId
      }

      if (uiMessageVersion === 4) {
        postMessageFunctions.onPostMessage(POST_MESSAGES.MEMBER_CONNECTED, eventMetadata)
        analyticFunctions.onAnalyticEvent(`connect_${POST_MESSAGES.MEMBER_CONNECTED}`, {
          type: connectConfig.is_mobile_webview ? 'url' : 'message',
        })
      } else if (hasAtriumAPI && isMobileWebview === true) {
        PostMessage.setWebviewUrl(`atrium://memberAdded/${currentMember.guid}`)
      } else {
        PostMessage.send('mxConnect:memberAdded', eventMetadata)
      }

      fadeOut(connectingRef.current, 'down').then(() => {
        dispatch(connectComplete())
      }, 1500)
    }
  }, [needsToInitializeJobSchedule, jobSchedule])

  const memberUseCasesWereProvidedInConfig = () => Boolean(connectConfig?.use_cases?.length)

  /**
   * @returns true if currentUseCases doesn't have all the newUseCases
   */
  const memberIsMissingAConfiguredUseCase = () => {
    const currentUseCases = currentMember?.use_cases

    if (!currentUseCases || !Array.isArray(currentUseCases)) {
      return true
    }

    const newUseCases = connectConfig.use_cases

    return newUseCases.some((useCase) => currentUseCases.includes(useCase) === false)
  }

  // When we mount, try to initialize the jobSchedule, but first we need the
  // most recent job details
  useEffect(() => {
    if (!needsToInitializeJobSchedule) return () => {}

    let sub$ = null
    const loadJob$ = defer(() => {
      // If we have a most recent job guid, get it, otherwise, just pass null
      if (currentMember.most_recent_job_guid) {
        return defer(() => api.loadJob(currentMember.most_recent_job_guid)).pipe(
          // I have to retry here because sometimes this is too fast in sand and
          // it 404s. This is a long standing backend problem.
          retry(1),
          // If we do error for real, just act as if there is no job
          catchError(() => of(null)),
        )
      } else {
        return of(null)
      }
    })

    if (memberUseCasesWereProvidedInConfig() && memberIsMissingAConfiguredUseCase()) {
      api.updateMember({ ...currentMember }, connectConfig).then((updatedMember) => {
        sub$ = loadJob$.subscribe((job) => {
          if (onUpsertMember) {
            onUpsertMember(updatedMember)
          }

          dispatch({
            type: ActionTypes.UPDATE_MEMBER_SUCCESS,
            payload: { item: updatedMember },
          })

          return dispatch(
            initializeJobSchedule(currentMember, job, connectConfig, isComboJobsEnabled),
          )
        })
      })
    } else {
      sub$ = loadJob$.subscribe((job) =>
        dispatch(initializeJobSchedule(currentMember, job, connectConfig, isComboJobsEnabled)),
      )
    }

    return () => sub$?.unsubscribe()
  }, [needsToInitializeJobSchedule])

  /**
   * If the member is not aggregating, start a job, otherwise, poll the
   * member until it's done aggregating.
   */
  useEffect(() => {
    // If we still need to initialize the job schedule, do nothing
    if (needsToInitializeJobSchedule || !activeJob) return () => {}

    const connectMember$ = defer(() => {
      const needsJobStarted = currentMember.is_being_aggregated === false

      const startJob$ = defer(() =>
        api.runJob(activeJob?.type, currentMember.guid, connectConfig, true),
      ).pipe(
        mergeMap(() => api.loadMemberByGuid(currentMember.guid)),

        catchError((error) => {
          // We control the scenarios of a 409 error (job already running, or member already exists).
          // We can safely continue forward if that is the error we got back.
          const isSafeConflictError = error?.response?.status === 409
          if (isSafeConflictError) {
            return of(currentMember)
          }

          // Prevent the Connecting component from trying to continue
          // when a bad error occurs.
          setConnectingError(error)
          throw error
        }),
      )

      // If the current member is not being aggregated, start a job
      // otherwise, just go with the member we have now
      return needsJobStarted ? startJob$ : of(currentMember)
    })
      .pipe(
        concatMap((member) =>
          pollMember(member.guid, api).pipe(
            tap((pollingState) => handleMemberPoll(pollingState)),
            filter((pollingState) => pollingState.jobIsDone),
            pluck('currentResponse'),
            take(1),
            mergeMap((polledMember) => {
              const loadLatestJob$ = defer(() => api.loadJob(member.most_recent_job_guid)).pipe(
                map((job) => ({ member: polledMember, job, hasInvalidData: false })),
              )

              if (connectConfig.mode === VERIFY_MODE) {
                /* 
                  invalidData$ is used when 
                  - There are no verifiable accounts (CONNECTED or IMPEDED member, during OAuth flow)
                  - SAS has no options (CHALLENGED member)
                */
                const invalidData$ = of({ member: {}, job: {}, hasInvalidData: true })

                if (
                  hasNoVerifiableAccounts(polledMember, connectConfig) ||
                  hasNoSingleAccountSelectOptions(polledMember)
                ) {
                  return invalidData$
                }
              }

              return loadLatestJob$
            }),
          ),
        ),
      )
      .subscribe(({ member, job, hasInvalidData }) => {
        if (hasInvalidData) {
          return dispatch({ type: ActionTypes.HAS_INVALID_DATA })
        }
        if (onUpsertMember) {
          onUpsertMember(member)
        }

        // if we are in an error state, fade out to ease the transition away
        // from this view
        if (ErrorStatuses.includes(member.connection_status)) {
          return fadeOut(connectingRef.current, 'down').then(() => {
            dispatch(jobComplete(member, job))
          })
        } else {
          return dispatch(jobComplete(member, job))
        }
      })

    return () => connectMember$.unsubscribe()
  }, [needsToInitializeJobSchedule, activeJob])

  /**
   * We removed the timeout step, but customer's relied on the timeout value in
   * the step change event to do things in their UI, so we need to bring the
   * message back in a way that makes sense.
   *
   * Now send the 'stepChange' event with the expected values when we move into
   * the timeout message here.
   */
  useEffect(() => {
    if (timedOut === true) {
      postMessageFunctions.onPostMessage('connect/stepChange', {
        previous: STEPS.CONNECTING,
        current: 'timeOut',
      })
    }
  }, [timedOut])

  if (connectingError !== null) {
    throw connectingError
  }

  return (
    <div ref={connectingRef} style={styles.container}>
      <SlideDown delay={getNextDelay()}>
        <div style={styles.logoHeader}>
          <ConnectLogoHeader
            institutionGuid={institution.guid}
            institutionLogo={institution.logo_url}
          />
        </div>
        <Text component="h2" style={styles.subHeader} truncate={false} variant="H2">
          {__('Connecting to %1', institution.name)}
        </Text>
      </SlideDown>

      <SlideDown delay={getNextDelay()}>
        <ProgressBar jobSchedule={jobSchedule} />
      </SlideDown>
      <AriaLive level="assertive" message={message} timeout={500} />
    </div>
  )
}

const getStyles = (tokens) => ({
  container: {
    textAlign: 'center',
  },
  logoHeader: {
    marginTop: tokens.Spacing.Medium,
    marginBottom: tokens.Spacing.Small,
  },
  message: {
    marginTop: tokens.Spacing.XLarge,
  },
  subHeader: {
    paddingTop: tokens.Spacing.Large,
  },
  spinner: {
    marginTop: tokens.Spacing.XLarge,
  },
})

Connecting.propTypes = {
  connectConfig: PropTypes.object.isRequired,
  hasAtriumAPI: PropTypes.bool,
  institution: PropTypes.object.isRequired,
  isMobileWebview: PropTypes.bool,
  onUpsertMember: PropTypes.func,
  uiMessageVersion: PropTypes.number,
}
