import {
  Button,
  Container,
  Grid,
  Header,
  Icon,
  Loader,
  Menu,
  Select,
} from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';

import AboutTab from '../graph_tabs/AboutTab';
import CountryDataTable from '../components/CountryDataTable';
import DateSlider from '../components/DateSlider';
import FocusTab from '../graph_tabs/FocusTab';
import ReactGA from 'react-ga';
import ReferencesTab from '../graph_tabs/ReferencesTab';
import SoftBodyTab from '../graph_tabs/SoftBodyTab';
import World from '../graph/World';
import extract_slices from '../graph/extract_slices';
import fetchData from '../js/fetchData';
import styled from 'styled-components';
import useInterval from '../hooks/useInterval';
import useLocalStorage from '../hooks/useLocalStorage';

const nslice = 8;
const top_label = 'World';
const playDelayInit = 0.1;
const playEndDelayInit = 3;

ReactGA.initialize('UA-168322336-1');
ReactGA.pageview(window.location.pathname + window.location.search);

function ui_key(uname) {
  return { key: uname, value: uname, text: uname };
}

const Graph = () => {
  const [loaderActive, setLoaderActive] = useState(true);
  const [propFocus, setPropFocus] = useLocalStorage('co-propFocus', 'Deaths');
  const [sumFocus, setSumFocus] = useLocalStorage('co-sumFocus', 'totals');
  const [
    focusCountries,
    setFocusCountries,
  ] = useLocalStorage('co-focusCountries', [
    'China',
    'United States',
    'Jamaica',
  ]);
  const [focusIndex, setFocusIndex] = useState(-1);
  const [countryFocus, setCountryFocus] = useState(top_label);
  const [playingState, setPlayingState] = useState(false);
  const [playIndex, setPlayIndex] = useState(-1);
  const [playDelay, setPlayDelay] = useState(playDelayInit);
  const [bottomTab, setBottomTab] = useLocalStorage('co-source', 'places');
  const [dateIndex, setDateIndex] = useLocalStorage('co-dataIndex', 0);
  const [regionOptions, setRegionOptions] = useLocalStorage('co-region');
  const [per100k, setPer100k] = useLocalStorage('co-per100k');

  const [dateFocus, setDateFocus] = useState();
  const [countrySelected, setCountrySelected] = useState({});
  const [metac, setMetac] = useState({});
  const [day, setDay] = useState({});
  const [sortedItems, setSortedItems] = useState();
  const [pieData, setPieData] = useState();

  const [sortColumn, setSortColumn] = useState('');

  // metac = {
  //   "c_ref": "US"
  //   totals: {
  //    "Cases": 1486757,
  //    "Deaths": 89562,
  //    "Recovered": 272265},
  //   daily: {
  //    "Cases": 1486757,
  //    "Deaths": 89562,
  //   }

  // console.log('countrySelected', countrySelected);

  const dataPrefix = (countrySelected) => {
    let prefix = '';
    if (countrySelected.c_ref) {
      for (
        let ncountry = countrySelected;
        ncountry;
        ncountry = ncountry.parent
      ) {
        let c_ref = ncountry.c_ref.replace(/ /g, '_').replace(/,/g, '');
        prefix = 'c_subs/' + c_ref + '/' + prefix;
      }
    }
    // prefix = prefix ? 'c_subs/' + prefix + '/' : '';
    return prefix;
  };

  useEffect(() => {
    // console.log('useEffect dates.json');
    const prefix = dataPrefix(countrySelected);
    fetchData('./c_data/' + prefix + 'c_meta.json', (meta) => {
      let dateList;
      let metaDict;
      let countryList;
      const process_dates = (dates) => {
        if (!dates) dates = [];
        dateList = dates.map((uname) => ui_key(uname));
      };

      // Odd: react complains of missing dependency if process_regions
      // is defined outside useEffect
      const process_regions = (regions) => {
        if (!regions) regions = [];
        metaDict = {};
        const list = regions.map((item) => {
          const uname = item.c_ref;
          metaDict[uname] = item;
          return ui_key(uname);
        });
        const forui = ui_key(top_label);
        countryList = [forui].concat(list);
      };

      if (!meta) meta = {};
      process_dates(meta.c_dates);
      process_regions(meta.c_regions);

      console.log('fetchData metac set c_regions n', meta.c_regions.length);
      // console.log('fetchData metac metaDict', metaDict);
      setMetac({
        countrySelected: countrySelected,
        dateList,
        metaDict,
        countryList,
      });
    });
  }, [countrySelected]);

  useEffect(() => {
    // console.log('useEffect c_days dateFocus', dateFocus, 'metac ', metac);
    if (
      !day.isLoading &&
      metac.metaDict &&
      (!dateFocus || day.dateFocus !== dateFocus)
    ) {
      day.isLoading = true;
      const prefix = dataPrefix(countrySelected);
      fetchData(
        './c_data/' + prefix + 'c_days/' + dateFocus + '.json',
        (items) => {
          if (!items) items = [];
          console.log(
            'fetchData c_days using metaDict n',
            Object.keys(metac.metaDict).length
          );
          items.forEach((item) => {
            const ent = metac.metaDict[item.c_ref];
            if (ent) {
              item.c_people = ent.c_people;
              item.n_states = ent.n_states;
            }
          });
          setDay({ items, dateFocus, isLoading: false });
        }
      );
    }
  }, [countrySelected, day, dateFocus, metac.metaDict, day.dateFocus, metac]);

  useEffect(() => {
    // console.log('useEffect day.items', day.items);
    // console.log('useEffect sorted_items', 'day', day, 'dateFocus', dateFocus);
    console.log(
      'useEffect sorted_items dateFocus',
      dateFocus,
      countrySelected.c_ref,
      !dateFocus || !day.items || day.isLoading
    );
    if (!dateFocus || !day.items || day.isLoading) return;

    // propValue is item[sumFocus][propFocus];
    // set propPerCent
    const items = day.items;
    let stats_total = 0;
    items.forEach((item) => {
      const nval = item[sumFocus][propFocus];
      item.propValue = nval;
      item.propValueTable = nval;
      if (nval > 0) stats_total += nval;
    });
    items.forEach((item) => {
      item.propPercent = stats_total ? item.propValue / stats_total : 0;
    });
    const sortPropValue = (item1, item2) => {
      const rank = item2.propValue - item1.propValue;
      if (rank === 0) return item1.c_ref.localeCompare(item2.c_ref);
      return rank;
    };
    const sorted_items = items.concat().sort(sortPropValue);

    let slideIndex = sorted_items.findIndex(
      (item) => item.c_ref === countryFocus
    );
    if (slideIndex < 0) slideIndex = 0;

    // const percents = 1;
    const pie0 = extract_slices(sorted_items, nslice, 1, slideIndex);
    const pie1 = extract_slices(sorted_items, nslice, 0, slideIndex);

    if (per100k) {
      sorted_items.forEach((item) => {
        if (item.c_people) {
          item.propValueTable = item.propValue * (100000 / item.c_people);
        } else {
          item.propValueInvalid = true;
          item.propValueTable = 0;
        }
      });
      // !!@ Awaiting sort in table header
      // const sortPropValueTable = (item1, item2) => {
      //   const rank = item2.propValueTable - item1.propValueTable;
      //   if (rank === 0) return item1.c_ref.localeCompare(item2.c_ref);
      //   return rank;
      // };
      // sorted_items.sort(sortPropValueTable);
    }
    let sortFunc;
    switch (sortColumn) {
      case 'region':
        sortFunc = (item1, item2) => {
          return item1.c_ref.localeCompare(item2.c_ref);
        };
        break;
      case 'prop':
        sortFunc = (item1, item2) => {
          const rank = item2.propValueTable - item1.propValueTable;
          if (rank === 0) return item1.c_ref.localeCompare(item2.c_ref);
          return rank;
        };
        break;
      case 'percent':
        sortFunc = (item1, item2) => {
          const rank = item2.propPercent - item1.propPercent;
          if (rank === 0) return item1.c_ref.localeCompare(item2.c_ref);
          return rank;
        };
        break;
      default:
        break;
    }
    if (sortFunc) {
      sorted_items.sort(sortFunc);
    }

    setPieData([pie0, pie1]);
    setSortedItems(sorted_items);
  }, [
    countrySelected,
    day,
    propFocus,
    countryFocus,
    sumFocus,
    dateFocus,
    per100k,
    sortColumn,
  ]);

  useInterval(
    () => {
      // console.log('useInterval playIndex', playIndex, 'isLoading', isLoading);
      if (!metac.dateList || day.isLoading) return;
      if (playIndex < 0) {
        return;
      }
      let ndelay = playDelayInit;
      if (!ndelay) return;
      let nplayIndex = playIndex + 1;
      if (nplayIndex >= metac.dateList.length) {
        nplayIndex = 0;
      } else if (nplayIndex === metac.dateList.length - 1) {
        ndelay = playEndDelayInit;
      }
      setPlayDelay(ndelay);
      setPlayIndex(nplayIndex);
      setDateFocus(metac.dateList[nplayIndex].value);
      setDateIndex(nplayIndex);
    },
    playingState ? playDelay * 1000 : null
  );

  // console.log('Graph countryFocus', countryFocus);

  const setDateIndexFocus = (value) => {
    const index = metac.dateList.findIndex((item) => item.value === value);
    setDateIndex(index);
    setDateFocus(value);
  };

  if (!dateFocus && metac.dateList && metac.dateList.length) {
    console.log(
      'dateFocus',
      dateFocus,
      'metac.dateList.length',
      metac.dateList.length
    );
    setDateIndexFocus(metac.dateList[metac.dateList.length - 1].value);
  }

  if (!pieData) {
    return <Loader active={loaderActive} inline></Loader>;
  }

  if (sortedItems.length > 0 && loaderActive) {
    setLoaderActive(false);
  }

  const playAction = () => {
    if (!playingState) {
      const nindex = metac.dateList.findIndex(
        (item) => item.value === dateFocus
      );
      setPlayIndex(nindex);
      setPlayDelay(playDelayInit);
      setPlayingState(true);
    } else {
      setPlayingState(false);
    }
  };

  const pauseAction = () => {
    setPlayingState(false);
  };

  const previousAction = () => {
    stepAction(-1);
  };

  const nextAction = () => {
    stepAction(1);
  };

  const stepAction = (delta) => {
    if (!metac.dateList) return;
    let index = metac.dateList.findIndex((item) => item.value === dateFocus);
    index += delta;
    if (index >= metac.dateList.length) {
      index = 0;
    } else if (index < 0) {
      index = metac.dateList.length - 1;
    }
    setDateIndexFocus(metac.dateList[index].value);
    pauseAction();
  };

  const findFirstDate = () => {
    console.log(
      'findFirstDate countryFocus',
      countryFocus,
      countrySelected.c_ref
    );
    if (countryFocus !== top_label && metac.metaDict) {
      const ent = metac.metaDict[countryFocus];
      if (ent) {
        const ndate = ent.c_first[propFocus];
        if (ndate) {
          setDateIndexFocus(ndate);
        }
      }
    } else if (metac.dateList && metac.dateList.length) {
      let fdate = '9999-99-99';
      for (let prop in metac.metaDict) {
        const cent = metac.metaDict[prop];
        const ndate = cent.c_first[propFocus];
        if (ndate < fdate) {
          fdate = ndate;
        }
      }
      // const ndate = metac.dateList[0].value;
      setDateIndexFocus(fdate);
    }
  };

  const findLastestDate = () => {
    if (metac.dateList && metac.dateList.length) {
      const ndate = metac.dateList[metac.dateList.length - 1].value;
      setDateIndexFocus(ndate);
    }
  };

  const DateFocusSelect = () => {
    // console.log('DateFocusSelect', dateFocus);
    return (
      <Select
        search
        value={dateFocus}
        onChange={(param, data) => {
          setDateIndexFocus(data.value);
        }}
        options={metac.dateList || []}
      />
    );
  };

  const CountrySelect = () => {
    return (
      <Select
        placeholder="Select Country"
        search
        selection
        value={countryFocus}
        onChange={(param, data) => {
          setCountryFocus(data.value);
          let nindex = focusCountries.indexOf(data.value);
          if (nindex >= 0) {
            setFocusIndex(nindex);
          } else {
            let nindex = focusIndex;
            if (nindex < 0) {
              nindex = 0;
              setFocusIndex(nindex);
            }
            const nfocusCountries = focusCountries.concat();
            nfocusCountries[nindex] = data.value;
            setFocusCountries(nfocusCountries);
            // setFocusCountries([data.value, focusCountries[0], focusCountries[1]]);
          }
        }}
        options={metac.countryList || []}
      />
    );
  };

  const showWorldAction = () => {
    setFocusIndex(-1);
    setCountryFocus(top_label);
  };

  const showCountryAction = (index) => {
    setFocusIndex(index);
    setCountryFocus(focusCountries[index]);
  };

  // On desktop: play/pause button flashes when playingState active
  // Not sure why - avoid for now
  // const ButtonPlayPause = () => {
  //   if (!playingState) {
  //   return (
  //     <Button size="mini" onClick={playAction}>
  //       <Icon name="play" />
  //     </Button>
  //   );
  //   }
  //   return (
  //     <Button size="mini" onClick={pauseAction}>
  //       <Icon name="pause" />
  //     </Button>
  //   );
  // };

  const handleBottomTab = (event, { name }) => {
    console.log('handleBottomTab name', name);
    setBottomTab(name);
  };

  const selectCasesAction = () => {
    setPropFocus('Cases');
  };
  const selectDeathsAction = () => {
    setPropFocus('Deaths');
  };

  const selectTotals = () => {
    setSumFocus('totals');
  };
  const selectDaily = () => {
    setSumFocus('daily');
  };

  const cactive = propFocus === 'Cases';
  const dactive = propFocus === 'Deaths';
  // const uiprop_s = cactive ? 'Cases' : propFocus;
  const uiprop_s = propFocus;
  const uiprop = uiprop_s.substring(0, uiprop_s.length - 1);
  const focus_actions = {
    CountrySelect,
    showWorldAction,
    findFirstDate,
    findLastestDate,
    uiprop,
    focusCountries,
    showCountryAction,
    focusIndex,
  };
  const to_active = sumFocus === 'totals';
  const da_active = sumFocus === 'daily';
  const uisum = sumFocus === 'totals' ? 'Total' : 'Daily';
  const upto_on = sumFocus === 'totals' ? 'total to' : 'on';

  const updateSlider = (key) => {
    // console.log('updateSlider key', key);
    setDateFocus(metac.dateList[key].value);
  };

  const graphOpacity = bottomTab === 'softbody' ? 0.6 : 1.0;

  const dateFocusShort = dateFocus && dateFocus.substring(5);

  const selectCountry = (country) => {
    console.log('selectCountry country', country);
    setDay({});
    setMetac({});
    if (countrySelected.c_ref) {
      country = { ...country, parent: countrySelected };
    }
    setCountrySelected(country);
  };

  const ui_top = countrySelected.c_ref ? countrySelected.c_ref : 'WorldWide';

  const selectWorldwide = () => {
    setDay({});
    setMetac({});
    setCountrySelected({});
  };

  const selectParentCounty = () => {
    setDay({});
    setMetac({});
    setCountrySelected(countrySelected.parent);
  };

  const regionPlusClick = () => {
    setRegionOptions(!regionOptions);
  };

  const clickPer100k = () => {
    setPer100k(!per100k);
  };

  const tunder = { textDecoration: 'underline' };
  const headerSpec = {
    region: {
      style: sortColumn === 'region' ? tunder : null,
      onclick: () => {
        setSortColumn('region');
      },
    },
    prop: {
      style: sortColumn === 'prop' ? tunder : null,
      onclick: () => {
        setSortColumn('prop');
      },
    },
    percent: {
      style: sortColumn === 'percent' ? tunder : null,
      onclick: () => {
        setSortColumn('percent');
      },
    },
  };

  const CountryNavButtons = () => {
    return (
      <>
        {countrySelected.c_ref && (
          <button onClick={selectWorldwide}>Worldwide</button>
        )}
        {countrySelected.parent && (
          <button onClick={selectParentCounty}>
            {countrySelected.parent.c_ref}
          </button>
        )}
      </>
    );
  };

  const RegionTab = () => {
    return (
      <div>
        <div>
          <button onClick={clickPer100k}>
            {per100k ? '-' : ''} Per 100,000
          </button>
          <button onClick={findFirstDate}>First {uiprop}</button>
          <button onClick={findLastestDate}>Latest</button>
          <CountryNavButtons />
          {/* {countrySelected.c_ref && (
            <button onClick={selectWorldwide}>Worldwide</button>
          )} */}
        </div>
        <CountryDataTable
          items={sortedItems || []}
          propTitle={uisum + ' ' + uiprop_s}
          pie_data={pieData}
          selectCountry={selectCountry}
          parentCountry={countrySelected.c_ref}
          regionPlusClick={regionPlusClick}
          regionOptions={regionOptions}
          per100k={per100k}
          headerSpec={headerSpec}
        />
      </div>
    );
  };

  const HeadStats = () => {
    const stats_total = pieData[0].stats_total;
    return (
      <Header as="h3">
        {ui_top}: {stats_total} {uiprop_s} {upto_on} {dateFocusShort}
      </Header>
    );
  };

  return (
    <>
      <Container style={{ marginTop: '1rem' }}>
        <Loader active={loaderActive} inline></Loader>
        <HeadStats />
        <World pie_data={pieData} opacity={graphOpacity} />
        <HeadStats />
        <Grid>
          <Grid.Row style={{ padding: '0 16px' }}>
            <DateSlider
              dateIndex={dateIndex}
              dateListLength={(metac.dateList || []).length}
              updateSlider={updateSlider}
            />
          </Grid.Row>
          <Grid.Row>
            <StyledControlRow>
              <Button.Group>
                <Button
                  size="mini"
                  onClick={selectCasesAction}
                  active={cactive}
                >
                  Cases
                </Button>
                <Button
                  size="mini"
                  onClick={selectDeathsAction}
                  active={dactive}
                >
                  Deaths
                </Button>
              </Button.Group>
              <Button.Group>
                <Button size="mini" onClick={selectTotals} active={to_active}>
                  Total:
                </Button>
                <Button size="mini" onClick={selectDaily} active={da_active}>
                  On date:
                </Button>
              </Button.Group>
              <div>
                <DateFocusSelect />
              </div>
              <Button.Group>
                <span>
                  <Button size="mini" onClick={previousAction}>
                    <Icon name="step backward" />
                  </Button>
                  {/* <ButtonPlayPause /> */}
                  <Button size="mini" onClick={playAction}>
                    <Icon name="play" />
                  </Button>
                  <Button size="mini" onClick={nextAction}>
                    <Icon name="step forward" />
                  </Button>
                </span>
              </Button.Group>
            </StyledControlRow>
          </Grid.Row>
        </Grid>
      </Container>
      <StyledDetailsContainer>
        <Menu tabular>
          <Menu.Item
            name="places"
            active={bottomTab === 'places'}
            content="Regions"
            onClick={handleBottomTab}
          />
          <Menu.Item
            name="purpose"
            active={bottomTab === 'purpose'}
            onClick={handleBottomTab}
          />
          <Menu.Item
            name="focus"
            active={bottomTab === 'focus'}
            onClick={handleBottomTab}
          />
          <Menu.Item
            name="softbody"
            content="p5js"
            active={bottomTab === 'softbody'}
            onClick={handleBottomTab}
          />
          <Menu.Item
            name="references"
            active={bottomTab === 'references'}
            onClick={handleBottomTab}
          />
        </Menu>
        {bottomTab === 'places' && <RegionTab />}
        {bottomTab === 'purpose' && <AboutTab />}
        {bottomTab === 'focus' && <FocusTab actions={focus_actions} />}
        {bottomTab === 'softbody' && <SoftBodyTab pie_data={pieData[0]} />}
        {bottomTab === 'references' && <ReferencesTab />}
      </StyledDetailsContainer>
    </>
  );
};

const StyledDetailsContainer = styled.div`
  margin: 3rem auto 1.5rem;
  max-width: 1172px;
`;

const StyledControlRow = styled.div`
  align-items: center;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: space-between;
  padding: 0 1rem;
  width: 100%;

  @media screen and (min-width: 64em) {
    justify-content: flex-end;

    .buttons,
    > div {
      margin-left: 1.5rem;
    }
  }

  .ui {
    margin-top: 8px;
  }
`;

export default Graph;

// <Button.Group>
//   <Button size="mini" onClick={selectWorldwide}>
//     &larr; Worldwide
//   </Button>
// </Button.Group>
