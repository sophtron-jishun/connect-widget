import React, { useEffect, useState, useContext } from 'react'
import PropTypes from 'prop-types'
import { defer } from 'rxjs'
import { useDispatch, useSelector } from 'react-redux'

import { useApi } from 'src/context/ApiContext'
import useAnalyticsPath from 'src/hooks/useAnalyticsPath'
import { PageviewInfo } from 'src/const/Analytics'
import { getCurrentMember, getSelectedInstitution } from 'src/redux/selectors/Connect'
import { ActionTypes } from 'src/redux/actions/Connect'
import { selectConfig } from 'src/redux/reducers/configSlice'

import { Credentials } from 'src/views/credentials/Credentials'
import { LoadingSpinner } from 'src/components/LoadingSpinner'

import { PostMessageContext } from 'src/ConnectWidget'

/**
 * Responsibilities:
 * - Get the member creds
 * - Render Credentials with the creds it received
 * - Performs the UPDATE
 */
export const UpdateMemberForm = (props) => {
  useAnalyticsPath(...PageviewInfo.CONNECT_UPDATE_CREDENTIALS)
  const institution = useSelector(getSelectedInstitution)
  const currentMember = useSelector(getCurrentMember)
  const config = useSelector(selectConfig)
  const isHuman = useSelector((state) => state.app.humanEvent)

  const [isUpdatingMember, setIsUpdatingMember] = useState(false)
  const [memberUpdateError, setMemberUpdateError] = useState(null)
  const [state, setState] = useState({
    isLoading: true,
    credentials: [],
    error: null,
  })

  const postMessageFunctions = useContext(PostMessageContext)
  const { api } = useApi()
  const dispatch = useDispatch()

  useEffect(() => {
    const request$ = defer(() => api.getMemberCredentials(currentMember.guid)).subscribe(
      (credentials) =>
        setState({
          isLoading: false,
          credentials,
          error: null,
        }),
      (error) => {
        setState({
          isLoading: false,
          credentials: [],
          error,
        })
      },
    )

    return () => request$.unsubscribe()
  }, [currentMember])

  const handleUpdateMember = (credentials) => {
    setIsUpdatingMember(true)
    const memberData = { ...currentMember, credentials }
    postMessageFunctions.onPostMessage('connect/updateCredentials', {
      institution: {
        guid: institution.guid,
        code: institution.code,
      },
      member_guid: currentMember.guid,
    })

    api
      .updateMember(memberData, config, isHuman)
      .then((response) => {
        if (props.onUpsertMember) {
          props.onUpsertMember(response)
        }
        return dispatch({
          type: ActionTypes.UPDATE_MEMBER_SUCCESS,
          payload: { item: response },
        })
      })
      .catch((error) => {
        setIsUpdatingMember(false)
        setMemberUpdateError(error.response)
      })
  }

  if (state.isLoading) {
    return <LoadingSpinner />
  }

  return (
    <Credentials
      credentials={state.credentials}
      error={memberUpdateError}
      handleSubmitCredentials={handleUpdateMember}
      isProcessingMember={isUpdatingMember}
      onDeleteConnectionClick={props.onDeleteConnectionClick}
      onGoBackClick={props.onGoBackClick}
      ref={props.navigationRef}
    />
  )
}

UpdateMemberForm.propTypes = {
  navigationRef: PropTypes.func.isRequired,
  onDeleteConnectionClick: PropTypes.func,
  onGoBackClick: PropTypes.func.isRequired,
  onUpsertMember: PropTypes.func,
}
