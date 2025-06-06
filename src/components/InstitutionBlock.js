import React from 'react'
import PropTypes from 'prop-types'
import { __ } from 'src/utilities/Intl'

import { useTokens } from '@kyper/tokenprovider'
import { InstitutionLogo } from '@kyper/mui'

import { formatUrl } from 'src/utilities/FormatUrl'

export const InstitutionBlock = ({ institution, style }) => {
  const { guid, logo_url, name, url } = institution

  const tokens = useTokens()
  const styles = getStyles(tokens)

  return (
    <div data-test="institution-block" style={{ ...styles.institutionBlock, ...style }}>
      <InstitutionLogo
        alt={`${name} logo`}
        data-test="institution-block-logo"
        institutionGuid={guid}
        logoUrl={logo_url}
        size={64}
      />
      <div style={styles.institutionInfo}>
        <div style={styles.institutionName}>
          {guid?.startsWith('INS-MANUAL') ? __('Manual Institution') : name}
        </div>

        <div style={styles.institutionUrl}>{formatUrl(url)}</div>
      </div>
    </div>
  )
}

const getStyles = (tokens) => {
  return {
    institutionBlock: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: tokens.Spacing.Large,
      borderRadius: tokens.BorderRadius.Container,
    },
    institutionInfo: {
      flexDirection: 'column',
      marginLeft: '12px',
      overflow: 'hidden',
    },
    institutionName: {
      color: tokens.TextColor.Default,
      fontSize: tokens.FontSize.Body,
      fontWeight: tokens.FontWeight.Bold,
      lineHeight: tokens.LineHeight.Body,
      paddingBottom: '2px',
    },
    institutionUrl: {
      color: tokens.TextColor.Secondary,
      fontWeight: tokens.FontWeight.Normal,
      fontSize: tokens.FontSize.ButtonLinkSmall,
      lineHeight: tokens.LineHeight.Body,
      textOverflow: 'ellipsis',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
    },
  }
}

InstitutionBlock.propTypes = {
  institution: PropTypes.object.isRequired,
  style: PropTypes.object,
}
