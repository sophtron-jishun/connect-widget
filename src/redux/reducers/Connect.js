import _find from 'lodash/find'
import _findIndex from 'lodash/findIndex'

import { ActionTypes } from 'src/redux/actions/Connect'
// import { ActionTypes as WidgetProfileActionTypes } from 'src/redux/actions/WidgetProfile'

import { ProcessingStatuses, ReadableStatuses } from 'src/const/Statuses'
import { AGG_MODE, VERIFY_MODE, STEPS } from 'src/const/Connect'
import { createReducer } from 'src/utilities/Reducer'
import * as JobSchedule from 'src/utilities/JobSchedule'
import { MicrodepositsStatuses } from 'src/views/microdeposits/const'
import { hasNoVerifiableAccounts, hasNoSingleAccountSelectOptions } from 'src/utilities/memberUtils'

export const defaultState = {
  error: null, // The most recent job request error, if any
  hasInvalidData: false, // no dda accounts for verification
  isComponentLoading: true, // whether or not the entire component is loading
  isConnectMounted: false,
  isOauthLoading: false, // whether or not the oauth process is starting
  oauthURL: null, // the URL to the oauth provider
  oauthErrorReason: null, // the reason there was an oauth error
  // whether or not there was an error *after* the user authenticated with
  // the provider, this means mx messed up after successful auth.
  loadError: null, // any error related to loading the widget, if any
  location: [], // Use pushLocation and popLocation where possible
  updateCredentials: false,
  selectedInstitution: {},
  // set by client config and resets after exiting Microdeposits back to Connect
  currentMicrodepositGuid: null,
  currentMemberGuid: '',
  members: [],
  jobSchedule: JobSchedule.UNINITIALIZED,
}

const loadConnect = (state, { payload }) => {
  return {
    ...defaultState,
    isConnectMounted: true,
    isComponentLoading: true,
    members: state.members,
    updateCredentials: payload.update_credentials || false,
  }
}

const loadConnectSuccess = (state, action) => {
  const {
    members,
    member,
    microdeposit,
    config = {},
    institution = {},
    widgetProfile,
  } = action.payload
  const currentMicrodepositGuid = config.current_microdeposit_guid
  let hasInvalidData = state.hasInvalidData
  let startingStep = getStartingStep(
    members,
    member,
    microdeposit,
    config,
    institution,
    widgetProfile,
  )

  if (
    member &&
    config.mode === VERIFY_MODE &&
    (hasNoVerifiableAccounts(member, config) || hasNoSingleAccountSelectOptions(member))
  ) {
    startingStep = STEPS.LOGIN_ERROR
    hasInvalidData = true
  }

  return {
    ...state,
    currentMemberGuid: member?.guid ?? defaultState.currentMemberGuid,
    currentMicrodepositGuid,
    isComponentLoading: false,
    location: pushLocation(state.location, startingStep),
    selectedInstitution: institution,
    hasInvalidData,
    updateCredentials:
      member?.connection_status === ReadableStatuses.DENIED || state.updateCredentials,
    members,
  }
}

const loadConnectError = (state, action) => ({
  ...state,
  loadError: action.payload,
  isComponentLoading: false,
})

/**
 * We need to make sure we clear out all of the connect state when it resets
 * or is unmounted from other widgets.
 *
 * However, there are some peices of 'app level' data (i.e. widgetProfile, members, isComponentLoading)
 * that we should keep around. This is because that data is only loaded once, when the app
 * initializes. We need to keep that data around until we can update connect to load the data for itself.
 */
const resetConnect = (state) => ({
  ...defaultState,
  isComponentLoading: state.isComponentLoading,
  members: state.members,
})

const goBackSearchOrVerify = (state, { payload }) => {
  return {
    ...state,
    location: resetLocation(state.members, payload, state.location),
    currentMemberGuid: defaultState.currentMemberGuid,
    error: defaultState.error,
    updateCredentials: defaultState.updateCredentials,
    oauthURL: defaultState.oauthURL,
    oauthErrorReason: defaultState.oauthErrorReason,
    jobSchedule: JobSchedule.UNINITIALIZED,
    hasInvalidData: defaultState.hasInvalidData,
    selectedInstitution: defaultState.selectedInstitution,
  }
}

const resetWidgetMFAStep = (state, { payload }) => {
  return {
    ...state,
    location: resetLocation(state.members, payload, state.location),
    currentMemberGuid: defaultState.currentMemberGuid,
    error: defaultState.error,
    updateCredentials: defaultState.updateCredentials,
    oauthURL: defaultState.oauthURL,
    oauthErrorReason: defaultState.oauthErrorReason,
    jobSchedule: JobSchedule.UNINITIALIZED,
    hasInvalidData: defaultState.hasInvalidData,
    selectedInstitution: defaultState.selectedInstitution,
  }
}

const resetWidgetConnected = (state) => {
  return {
    ...state,
    currentMemberGuid: defaultState.currentMemberGuid,
    error: defaultState.error,
    updateCredentials: defaultState.updateCredentials,
    oauthURL: defaultState.oauthURL,
    oauthErrorReason: defaultState.oauthErrorReason,
    jobSchedule: JobSchedule.UNINITIALIZED,
    hasInvalidData: defaultState.hasInvalidData,
    selectedInstitution: defaultState.selectedInstitution,
    // This overrides/resets the location to always only be the search step.
    location: pushLocation(state.location, STEPS.SEARCH, true),
  }
}

const verifyDifferentConnection = (state) => ({
  ...state,
  error: defaultState.error,
  location: pushLocation(state.location, STEPS.SEARCH),
  updateCredentials: defaultState.updateCredentials,
  oauthURL: defaultState.oauthURL,
})

const loginErrorStartOver = (state, action) => {
  const mode = action.payload.mode
  const iavMembers = getIavMembers(state.members)
  return {
    ...defaultState,
    isComponentLoading: state.isComponentLoading,
    isConnectMounted: state.isConnectMounted,
    location: pushLocation(
      state.location,
      mode === VERIFY_MODE && iavMembers.length > 0 ? STEPS.VERIFY_EXISTING_MEMBER : STEPS.SEARCH,
      true,
    ),
    members: state.members,
  }
}

const deleteMemberSuccess = (state, { payload }) => ({
  ...state,
  members: deleteMemberFromMembers(payload.memberGuid, state.members),
})

const stepToDeleteMemberSuccess = (state, { payload }) => ({
  ...state,
  location: pushLocation(state.location, STEPS.DELETE_MEMBER_SUCCESS),
  members: deleteMemberFromMembers(payload.memberGuid, state.members),
})

const deleteMemberSuccessReset = (state, { payload }) => {
  return {
    ...state,
    location: resetLocation(state.members, payload, state.location),
    currentMemberGuid: defaultState.currentMemberGuid,
    error: defaultState.error,
    updateCredentials: defaultState.updateCredentials,
    oauthURL: defaultState.oauthURL,
    oauthErrorReason: defaultState.oauthErrorReason,
    jobSchedule: JobSchedule.UNINITIALIZED,
    hasInvalidData: defaultState.hasInvalidData,
  }
}

const userConsented = (state) => ({
  ...state,
  location: pushLocation(state.location, STEPS.ENTER_CREDENTIALS),
})

// when updating credentials go to enter creds but with updateCredentials as true
const stepToUpdateCredentials = (state) => ({
  ...state,
  location: pushLocation(state.location, STEPS.ENTER_CREDENTIALS, true),
  updateCredentials: true,
})

const stepToMFA = (state, action) => ({
  ...state,
  location: pushLocation(state.location, STEPS.MFA),
  currentMemberGuid: action.payload,
})

const stepToConnecting = (state) => ({
  ...state,
  location: pushLocation(state.location, STEPS.CONNECTING),
})
const stepToVerifyExistingMember = (state) => ({
  ...state,
  location: pushLocation(state.location, STEPS.VERIFY_EXISTING_MEMBER),
})

const stepToAddManualAccount = (state) => ({
  ...state,
  location: pushLocation(state.location, STEPS.ADD_MANUAL_ACCOUNT),
})

function stepToLoginError(state) {
  return {
    ...state,
    location: pushLocation(state.location, STEPS.LOGIN_ERROR),
  }
}

const acceptDisclosure = (state, { payload }) => {
  let nextStep = STEPS.SEARCH

  if (
    state.selectedInstitution &&
    (payload.current_institution_guid || payload.current_institution_code)
  ) {
    // They configured connect with an institution
    nextStep = STEPS.ENTER_CREDENTIALS
  } else if (payload.mode === VERIFY_MODE) {
    // They are in verification mode, with no member or institution pre configured
    const iavMembers = getIavMembers(state.members)
    nextStep = iavMembers.length > 0 ? STEPS.VERIFY_EXISTING_MEMBER : STEPS.SEARCH
  }

  return { ...state, location: pushLocation(state.location, nextStep) }
}

const selectInstitutionSuccess = (state, action) => {
  return {
    ...state,
    location: pushLocation(
      state.location,
      action.payload.consentFlag ? STEPS.CONSENT : STEPS.ENTER_CREDENTIALS,
    ),
    selectedInstitution: action.payload.institution,
  }
}

// Oauth reducers
const startOauth = (state, action) => ({
  ...state,
  location: pushLocation(state.location, STEPS.ENTER_CREDENTIALS),
  currentMemberGuid: action.payload.member.guid,
  selectedInstitution: action.payload.institution,
})
const startOauthSuccess = (state, action) => ({
  ...state,
  currentMemberGuid: action.payload.member.guid,
  isOauthLoading: false,
  members: upsertMember(state, { payload: action.payload.member }),
  oauthURL: action.payload.oauthWindowURI,
})
const oauthCompleteSuccess = (state, action) => {
  return {
    ...state,
    currentMemberGuid: action.payload,
    location: pushLocation(state.location, STEPS.CONNECTING),
  }
}
const oauthError = (state, action) => ({
  ...state,
  currentMemberGuid: action.payload.memberGuid,
  location: pushLocation(state.location, STEPS.OAUTH_ERROR),
  oauthURL: defaultState.oauthURL,
  oauthErrorReason: action.payload.errorReason,
})
const retryOAuth = (state) => ({
  ...state,
  location: popLocation(state),
  oauthURL: defaultState.oauthURL,
  oauthErrorReason: defaultState.oauthErrorReason,
})

const stepToMicrodeposits = (state) => ({
  ...defaultState,
  currentMicrodepositGuid: state.currentMicrodepositGuid,
  isComponentLoading: state.isComponentLoading,
  isConnectMounted: state.isConnectMounted,
  location: pushLocation(state.location, STEPS.MICRODEPOSITS),
})

const jobComplete = (state, action) => {
  const { member, job } = action.payload
  const members = upsertMember(state, { payload: member })

  // If we are connected, just update the jobschedule
  if (member.connection_status === ReadableStatuses.CONNECTED) {
    const scheduledJobs = JobSchedule.onJobFinished(state.jobSchedule, job)

    return { ...state, currentMemberGuid: member.guid, jobSchedule: scheduledJobs, members }
  }

  // If we are not connected, go to the step based on connection status
  return {
    ...state,
    currentMemberGuid: member.guid,
    location: pushLocation(state.location, getStepFromMember(member)),
    members,
    updateCredentials:
      member.connection_status === ReadableStatuses.DENIED || state.updateCredentials,
  }
}

const createMemberSuccess = (state, action) => ({
  ...state,
  // TODO: Remove the use of `item` in the next two lines.
  currentMemberGuid: action.payload.item.guid,
  members: upsertMember(state, { payload: action.payload.item }),
  location: pushLocation(state.location, STEPS.CONNECTING),
})

const updateMemberSuccess = (state, action) => ({
  ...state,
  currentMemberGuid: action.payload.item.guid,
  location: pushLocation(state.location, STEPS.CONNECTING),
  members: upsertMember(state, { payload: action.payload.item }),
})

const initializeJobSchedule = (state, action) => {
  const { member, job, config, isComboJobsEnabled } = action.payload

  const jobSchedule = JobSchedule.initialize(member, job, config, isComboJobsEnabled)

  return { ...state, jobSchedule }
}

const verifyExistingConnection = (state, action) => {
  return {
    ...state,
    currentMemberGuid: action.payload.member.guid,
    location: pushLocation(state.location, STEPS.CONNECTING),
    selectedInstitution: action.payload.institution,
  }
}

const connectComplete = (state) => ({
  ...state,
  location: pushLocation(state.location, STEPS.CONNECTED),
})

// Exit MD and reset state
const finishMicrodeposits = (state) => ({
  ...state,
  location: pushLocation(state.location, STEPS.SEARCH, true),
  error: defaultState.error,
  updateCredentials: defaultState.updateCredentials,
  oauthURL: defaultState.oauthURL,
  currentMicrodepositGuid: defaultState.currentMicrodepositGuid,
})

// Exit MD but dont reset state
const exitMicrodeposits = (state) => ({
  ...state,
  location: pushLocation(state.location, STEPS.SEARCH, true),
})

/**
 * When a manual account is added and it has a member in the payload, update
 * members to include the new member
 */
const addManualAccount = (state, { payload }) => {
  if (payload && payload.member) {
    return {
      ...state,
      members: upsertMember(state, { payload: payload.member }),
    }
  }
  return state
}

const resetWidgetInvalidData = (state) => {
  return {
    ...state,
    location: pushLocation(state.location, STEPS.SEARCH, true),
    error: defaultState.error,
    updateCredentials: defaultState.updateCredentials,
    oauthURL: defaultState.oauthURL,
    oauthErrorReason: defaultState.oauthErrorReason,
    jobSchedule: JobSchedule.UNINITIALIZED,
    currentMemberGuid: defaultState.currentMemberGuid,
    hasInvalidData: defaultState.hasInvalidData,
  }
}
const hasInvalidData = (state) => {
  return {
    ...state,
    location: pushLocation(state.location, STEPS.LOGIN_ERROR),
    hasInvalidData: true,
  }
}

const connectGoBack = (state) => {
  return {
    ...state,
    location: popLocation(state),
  }
}

/**
 *  Helper functions
 */
// Helper to either update or add the member to the members array.
const upsertMember = (state, action) => {
  const loadedMember = action.payload
  const previousMember = _find(state.members, { guid: loadedMember.guid })

  if (previousMember) {
    return [...state.members.filter((member) => member.guid !== previousMember.guid), loadedMember]
  }

  return [...state.members, loadedMember]
}
function getStartingStep(members, member, microdeposit, config, institution, widgetProfile) {
  const shouldStepToMFA =
    member && config.update_credentials && member.connection_status === ReadableStatuses.CHALLENGED
  const shouldUpdateCredentials =
    member && (config.update_credentials || member.connection_status === ReadableStatuses.DENIED)

  if (shouldStepToMFA) {
    return STEPS.MFA
  } else if (shouldUpdateCredentials) {
    return STEPS.ENTER_CREDENTIALS
  } else if (member && config.current_member_guid) {
    const shouldStepToConnecting =
      member.connection_status === ReadableStatuses.REJECTED ||
      member.connection_status === ReadableStatuses.EXPIRED

    return shouldStepToConnecting ? STEPS.CONNECTING : getStepFromMember(member)
  } else if (
    config.current_microdeposit_guid &&
    config.mode === VERIFY_MODE &&
    microdeposit.status !== MicrodepositsStatuses.PREINITIATED
  ) {
    // They configured connect with a non PREINITIATED microdeposit, step to MICRODEPOSITS.
    return STEPS.MICRODEPOSITS
  } else if (widgetProfile.display_disclosure_in_connect) {
    return STEPS.DISCLOSURE
  } else if (institution && (config.current_institution_guid || config.current_institution_code)) {
    // They configured connect with an institution
    return STEPS.ENTER_CREDENTIALS
  } else if (config.mode === VERIFY_MODE) {
    // They are in verification mode, with no member or institution pre configured
    const iavMembers = getIavMembers(members)
    return iavMembers.length > 0 ? STEPS.VERIFY_EXISTING_MEMBER : STEPS.SEARCH
  }

  return STEPS.SEARCH
}
function getStepFromMember(member) {
  const connection_status = member.connection_status

  if (connection_status === ReadableStatuses.CHALLENGED) {
    return STEPS.MFA
  } else if (connection_status === ReadableStatuses.CONNECTED) {
    return STEPS.CONNECTED
  } else if (
    connection_status === ReadableStatuses.PENDING ||
    connection_status === ReadableStatuses.DENIED
  ) {
    return STEPS.ENTER_CREDENTIALS
  } else if (ProcessingStatuses.indexOf(connection_status) !== -1) {
    return STEPS.CONNECTING
  } else {
    return STEPS.LOGIN_ERROR
  }
}
function getIavMembers(members) {
  // Verification mode is enabled on the members, and they are not pre configured
  const iavMembers = members.filter(
    (member) =>
      member.verification_is_enabled && member.connection_status !== ReadableStatuses.PENDING,
  )
  return iavMembers
}
/**
 * Use to remove a member with "guid" from an array of members
 * @param {String} guid guid of member to remove
 * @param {Array<{guid: string}>} members Array of members with a guid property
 * @returns Array of remaining members
 */
const deleteMemberFromMembers = (guid, members) => members.filter((member) => member.guid !== guid)
/**
 * pushLocation - Util function
 * @param {Array} location This is simply state.location
 * @param {string} step This is one of our STEPS variables
 * @param {boolean} reset This is optional, clears and sets location to only the passed step
 * @returns Updated location array
 */
const pushLocation = (location, step, reset = false) =>
  reset ? [{ step }] : [...location, { step }]
/**
 * popLocation - Util function
 * @param {Array} state The current state of the application.
 * @returns {Array} An array representing the new location of the user in the application.
 */
const popLocation = (state) => {
  const newLocation = [...state.location]

  newLocation.pop()

  return newLocation
}
/**
 * Resets the location of the user in the application.
 * @param {Object} members - The current members.
 *  @param {Object} connectConfig - connectConfig.
 *  @param {Object} location - The location of the user in the application.
 * @return {Array} An array representing the new location of the user in the application.
 */
const resetLocation = (members, connectConfig, location) => {
  const iavMembers = getIavMembers(members)
  const mode = connectConfig.mode || AGG_MODE
  const step =
    mode === VERIFY_MODE && iavMembers.length > 0 ? STEPS.VERIFY_EXISTING_MEMBER : STEPS.SEARCH
  const index = _findIndex(
    location,
    (e) => e.step === STEPS.VERIFY_EXISTING_MEMBER || e.step === STEPS.SEARCH,
  )

  if (index === -1) {
    return [{ step }]
  } else {
    const newLocation = [...location]

    newLocation.splice(index + 1)

    return newLocation
  }
}

export const connect = createReducer(defaultState, {
  [ActionTypes.ACCEPT_DISCLOSURE]: acceptDisclosure,
  [ActionTypes.CREATE_MEMBER_SUCCESS]: createMemberSuccess,
  [ActionTypes.CONNECT_COMPLETE]: connectComplete,
  [ActionTypes.GO_BACK_CREDENTIALS]: goBackSearchOrVerify,
  [ActionTypes.GO_BACK_POST_MESSAGE]: goBackSearchOrVerify,
  [ActionTypes.EXIT_MICRODEPOSITS]: exitMicrodeposits,
  [ActionTypes.FINISH_MICRODEPOSITS]: finishMicrodeposits,
  [ActionTypes.GO_BACK_OAUTH]: goBackSearchOrVerify,
  [ActionTypes.DELETE_MEMBER_SUCCESS]: deleteMemberSuccess,
  [ActionTypes.STEP_TO_DELETE_MEMBER_SUCCESS]: stepToDeleteMemberSuccess,
  [ActionTypes.DELETE_MEMBER_SUCCESS_RESET]: deleteMemberSuccessReset,
  [ActionTypes.HAS_INVALID_DATA]: hasInvalidData,
  [ActionTypes.INIT_JOB_SCHEDULE]: initializeJobSchedule,
  [ActionTypes.JOB_COMPLETE]: jobComplete,
  [ActionTypes.LOAD_CONNECT]: loadConnect,
  [ActionTypes.LOAD_CONNECT_ERROR]: loadConnectError,
  [ActionTypes.LOAD_CONNECT_SUCCESS]: loadConnectSuccess,
  [ActionTypes.GO_BACK_MANUAL_ACCOUNT]: goBackSearchOrVerify,
  [ActionTypes.OAUTH_COMPLETE_SUCCESS]: oauthCompleteSuccess,
  [ActionTypes.OAUTH_COMPLETE_ERROR]: oauthError,
  [ActionTypes.RESET_CONNECT]: resetConnect,
  [ActionTypes.RETRY_OAUTH]: retryOAuth,
  [ActionTypes.RESET_WIDGET_CONNECTED]: resetWidgetConnected,
  [ActionTypes.RESET_WIDGET_MFA_STEP]: resetWidgetMFAStep,
  [ActionTypes.RESET_WIDGET_NO_ELIGIBLE_ACCOUNTS]: resetWidgetInvalidData,
  [ActionTypes.SELECT_INSTITUTION_SUCCESS]: selectInstitutionSuccess,
  [ActionTypes.START_OAUTH]: startOauth,
  [ActionTypes.START_OAUTH_SUCCESS]: startOauthSuccess,
  [ActionTypes.STEP_TO_ADD_MANUAL_ACCOUNT]: stepToAddManualAccount,
  [ActionTypes.STEP_TO_CONNECTING]: stepToConnecting,
  [ActionTypes.STEP_TO_MICRODEPOSIT]: stepToMicrodeposits,
  [ActionTypes.STEP_TO_VERIFY_EXISTING_MEMBER]: stepToVerifyExistingMember,
  [ActionTypes.STEP_TO_UPDATE_CREDENTIALS]: stepToUpdateCredentials,
  [ActionTypes.STEP_TO_MFA]: stepToMFA,
  [ActionTypes.VERIFY_DIFFERENT_CONNECTION]: verifyDifferentConnection,
  [ActionTypes.VERIFY_EXISTING_CONNECTION]: verifyExistingConnection,
  [ActionTypes.UPDATE_MEMBER_SUCCESS]: updateMemberSuccess,
  [ActionTypes.USER_CONSENTED]: userConsented,
  [ActionTypes.MFA_CONNECT_SUBMIT_SUCCESS]: updateMemberSuccess,
  [ActionTypes.MFA_CONNECT_SUBMIT_ERROR]: stepToLoginError,
  [ActionTypes.ADD_MANUAL_ACCOUNT_SUCCESS]: addManualAccount,
  [ActionTypes.LOGIN_ERROR_START_OVER]: loginErrorStartOver,
  [ActionTypes.CONNECT_GO_BACK]: connectGoBack,
})
